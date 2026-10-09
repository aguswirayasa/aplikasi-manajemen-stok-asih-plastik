import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const fromProject = createRequire(`${process.cwd()}/package.json`);
const ts = fromProject('typescript');
const helpers = fromProject('./lib/api-helpers.ts');
const validators = fromProject('./lib/password-validation.ts');
const nextServer = fromProject('next/server');
const now = new Date('2026-10-08T10:00:00.000Z');
const users = [
  { id: 'admin', username: 'admin', password: 'old-hash', role: 'ADMIN', isActive: true, email: 'admin@example.com', sessionVersion: 2, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'employee', username: 'worker', password: 'hash', role: 'PEGAWAI', isActive: true, email: 'worker@example.com', sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'admin-two', username: 'admin-two', password: 'hash', role: 'ADMIN', isActive: true, email: 'second@example.com', sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'admin-no-email', username: 'admin-no-email', password: 'hash', role: 'ADMIN', isActive: true, email: null, sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'admin-cooldown', username: 'admin-cooldown', password: 'hash', role: 'ADMIN', isActive: true, email: 'cooldown@example.com', sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'reset-post', username: 'reset-post', password: 'old-hash', role: 'ADMIN', isActive: true, email: 'reset@example.com', sessionVersion: 4, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'inactive-reset', username: 'inactive-reset', password: 'hash', role: 'ADMIN', isActive: false, email: 'inactive@example.com', sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'inactive-employee', username: 'inactive-employee', password: 'hash', role: 'PEGAWAI', isActive: false, email: 'employee@example.com', sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'email-less-employee', username: 'email-less-employee', password: 'hash', role: 'PEGAWAI', isActive: true, email: null, sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'email-less-reset', username: 'email-less-reset', password: 'hash', role: 'ADMIN', isActive: true, email: null, sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  { id: 'stale-reset', username: 'stale-reset', password: 'old-hash', role: 'ADMIN', isActive: true, email: 'before@example.com', sessionVersion: 8, passwordResetTokenHash: null, passwordResetExpiresAt: null },
];
let sends = [];
let failDelivery = false;
let failNotification = false;
let replacementOnFailure = false;
let beforePasswordHash = null;
let lookups = 0;
let afterJobs = [];

function matches(user, where) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return expected.some((condition) => matches(user, condition));
    if (key === 'AND') return expected.every((condition) => matches(user, condition));
    const actual = user[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === 'gt') return actual instanceof Date && actual > value;
        if (operator === 'gte') return actual instanceof Date && actual >= value;
        if (operator === 'lt') return actual instanceof Date && actual < value;
        if (operator === 'lte') return actual instanceof Date && actual <= value;
        return false;
      });
    }
    return actual === expected;
  });
}

const prisma = { user: {
  async findUnique({ where }) {
    lookups++;
    const user = users.find((item) => matches(item, where));
    return user ? structuredClone(user) : null;
  },
  async updateMany({ where, data }) {
    const user = users.find((item) => matches(item, where));
    if (!user) return { count: 0 };
    for (const [key, value] of Object.entries(data)) {
      user[key] = key === 'sessionVersion' && typeof value === 'object'
        ? user[key] + value.increment
        : value;
    }
    return { count: 1 };
  },
} };

function load(sourcePath, dependencies) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(id) {
      if (id in dependencies) return dependencies[id];
      throw new Error(`Unexpected dependency: ${id}`);
    },
    process,
    Buffer,
    URL,
    console: { error() {} },
    Date,
  });
  return exports;
}

const email = {
  async sendPasswordResetEmail(to, url) {
    sends.push({ kind: 'reset', to, url });
    if (replacementOnFailure) users[0].passwordResetTokenHash = 'newer-token-hash';
    if (failDelivery) throw new Error('SMTP credentials leaked here');
  },
  async sendPasswordChangedEmail(to) {
    sends.push({ kind: 'changed', to });
    if (failNotification) throw new Error('SMTP credentials leaked here');
  },
};
const bcrypt = fromProject('bcryptjs');
const service = load('lib/password-reset.ts', {
  '@/lib/prisma': { __esModule: true, default: prisma },
  '@/lib/api-helpers': helpers,
  '@/lib/password-validation': validators,
  '@/lib/email': email,
  bcryptjs: { __esModule: true, default: {
    async hash(value, rounds) {
      if (beforePasswordHash) await beforePasswordHash();
      return bcrypt.hash(value, rounds);
    },
  } },
  'node:crypto': fromProject('node:crypto'),
});
const after = (callback) => afterJobs.push(callback);
const routeDeps = {
  '@/lib/api-helpers': helpers,
  '@/lib/password-reset': service,
  '@/lib/password-validation': validators,
  '@/lib/email': email,
  'next/server': { ...nextServer, after },
};
const forgot = load('app/api/auth/forgot-password/route.ts', routeDeps);
const reset = load('app/api/auth/reset-password/route.ts', routeDeps);

function request(body, origin = 'https://stock.example.com') {
  return {
    url: 'https://stock.example.com/api/auth/reset-password',
    headers: new Headers(origin ? { origin } : {}),
    async json() {
      if (body instanceof Error) throw body;
      return body;
    },
  };
}

async function main() {
  process.env.NEXTAUTH_URL = 'https://stock.example.com';
  const beforeLookups = lookups;
  const noForgotOrigin = await forgot.POST(request({ identifier: 'admin' }, ''));
  assert.equal(noForgotOrigin.status, 403);
  const crossSiteForgot = await forgot.POST(request({ identifier: 'admin' }, 'https://evil.example'));
  assert.equal(crossSiteForgot.status, 403);
  assert.equal(afterJobs.length, 0);
  const malformed = await forgot.POST(request(new SyntaxError('bad json')));
  assert.equal(malformed.status, 400);
  assert.equal(lookups, beforeLookups);
  assert.equal(malformed.headers.get('cache-control'), 'no-store');

  const generic = await forgot.POST(request({ identifier: 'admin' }));
  assert.equal(generic.status, 200);
  const genericBody = await generic.json();
  assert.equal(genericBody.message, 'Jika akun terdaftar dan memiliki email pemulihan, Anda akan menerima tautan reset password.');
  assert.equal(lookups, beforeLookups);
  const issuedAt = Date.now();
  await afterJobs.shift()();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].to, 'admin@example.com');
  const token = new URL(sends[0].url).searchParams.get('token');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(users[0].passwordResetTokenHash, createHash('sha256').update(token).digest('hex'));
  assert.ok(Math.abs(users[0].passwordResetExpiresAt.getTime() - issuedAt - 15 * 60 * 1000) < 5000);

  const unknown = await forgot.POST(request({ identifier: 'not-a-user' }));
  assert.deepEqual(await unknown.json(), genericBody);
  await afterJobs.shift()();
  assert.equal(sends.length, 1);

  const cooldown = await service.requestPasswordReset('admin', now);
  assert.equal(cooldown, false);
  assert.equal(sends.length, 1);

  assert.equal(await service.requestPasswordReset('admin-no-email', now), false);
  assert.equal(await service.requestPasswordReset('inactive-employee', now), false);
  assert.equal(await service.requestPasswordReset('email-less-employee', now), false);
  assert.equal(sends.length, 1);

  users.push({ id: 'username-collision', username: 'duplicate@example.com', password: 'h', role: 'ADMIN', isActive: true, email: null, sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null });
  users.push({ id: 'email-collision', username: 'other', password: 'h', role: 'ADMIN', isActive: true, email: 'duplicate@example.com', sessionVersion: 0, passwordResetTokenHash: null, passwordResetExpiresAt: null });
  assert.equal(await service.requestPasswordReset('duplicate@example.com', now), false);

  failDelivery = true;
  replacementOnFailure = true;
  users[0].passwordResetExpiresAt = new Date(now.getTime() - 1);
  await assert.rejects(service.requestPasswordReset('admin', now));
  assert.equal(users[0].passwordResetTokenHash, 'newer-token-hash');
  users[0].passwordResetTokenHash = null;
  replacementOnFailure = false;
  failDelivery = false;

  const crossOrigin = await reset.POST(request({ token, password: 'new password', confirmPassword: 'new password' }, 'https://evil.example'));
  assert.equal(crossOrigin.status, 403);
  const missingResetOrigin = await reset.POST(request({ token, password: 'new password', confirmPassword: 'new password' }, ''));
  assert.equal(missingResetOrigin.status, 403);
  assert.equal(users[0].password, 'old-hash');
  const malformedOrigin = await reset.POST(request({ token, password: 'new password', confirmPassword: 'new password' }, 'invalid-origin'));
  assert.equal(malformedOrigin.status, 403);

  const expiredToken = 'a'.repeat(64);
  users[0].passwordResetTokenHash = createHash('sha256').update(expiredToken).digest('hex');
  users[0].passwordResetExpiresAt = new Date(now.getTime() - 1);
  assert.equal(await service.consumePasswordReset(expiredToken, 'new password', now), null);

  users[0].passwordResetTokenHash = createHash('sha256').update(token).digest('hex');
  users[0].passwordResetExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  const results = await Promise.all([
    service.consumePasswordReset(token, 'new password', now),
    service.consumePasswordReset(token, 'new password', now),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(users[0].sessionVersion, 3);
  assert.equal(users[0].passwordResetTokenHash, null);
  assert.equal(await fromProject('bcryptjs').compare('new password', users[0].password), true);

  const concurrentIssuance = await Promise.all([
    service.requestPasswordReset('admin-two', now),
    service.requestPasswordReset('admin-two', now),
  ]);
  assert.equal(concurrentIssuance.filter(Boolean).length, 1);

  assert.equal(await service.requestPasswordReset('admin-cooldown', now), true);
  assert.equal(await service.requestPasswordReset('admin-cooldown', new Date(now.getTime() + 59_999)), false);
  assert.equal(await service.requestPasswordReset('admin-cooldown', new Date(now.getTime() + 60_000)), true);

  for (const [id, tokenValue] of [
    ['inactive-reset', 'b'.repeat(64)],
    ['inactive-employee', 'c'.repeat(64)],
    ['email-less-employee', '8'.repeat(64)],
    ['email-less-reset', 'd'.repeat(64)],
  ]) {
    const user = users.find((item) => item.id === id);
    user.passwordResetTokenHash = createHash('sha256').update(tokenValue).digest('hex');
    user.passwordResetExpiresAt = new Date(now.getTime() + 60_000);
    assert.equal(await service.consumePasswordReset(tokenValue, 'new password', now), null);
    assert.equal(user.password, 'hash');
  }

  const replacedToken = 'e'.repeat(64);
  const replacementToken = 'f'.repeat(64);
  const resetPostUser = users.find((item) => item.id === 'reset-post');
  resetPostUser.passwordResetTokenHash = createHash('sha256').update(replacementToken).digest('hex');
  resetPostUser.passwordResetExpiresAt = new Date(Date.now() + 60_000);
  assert.equal(await service.consumePasswordReset(replacedToken, 'new password', now), null);
  resetPostUser.passwordResetTokenHash = createHash('sha256').update(replacedToken).digest('hex');

  const mismatched = await reset.POST(request({ token: replacedToken, password: 'new password', confirmPassword: 'different password' }));
  assert.equal(mismatched.status, 400);
  assert.equal(resetPostUser.passwordResetTokenHash, createHash('sha256').update(replacedToken).digest('hex'));
  assert.equal(resetPostUser.password, 'old-hash');

  const resetSuccess = await reset.POST(request({ token: replacedToken, password: 'new password', confirmPassword: 'new password' }));
  assert.equal(resetSuccess.status, 200);
  assert.equal((await resetSuccess.json()).message, 'Password berhasil direset. Silakan masuk kembali.');
  failNotification = true;
  await afterJobs.shift()();
  failNotification = false;
  assert.equal(resetPostUser.sessionVersion, 5);
  assert.equal(resetPostUser.passwordResetTokenHash, null);
  assert.equal(await bcrypt.compare('new password', resetPostUser.password), true);

  const staleToken = '9'.repeat(64);
  const staleUser = users.find((item) => item.id === 'stale-reset');
  staleUser.passwordResetTokenHash = createHash('sha256').update(staleToken).digest('hex');
  staleUser.passwordResetExpiresAt = new Date(now.getTime() + 60_000);
  beforePasswordHash = async () => {
    staleUser.email = 'after@example.com';
    staleUser.sessionVersion++;
  };
  assert.equal(await service.consumePasswordReset(staleToken, 'new password', now), null);
  beforePasswordHash = null;
  assert.equal(staleUser.password, 'old-hash');
  assert.equal(staleUser.passwordResetTokenHash, createHash('sha256').update(staleToken).digest('hex'));

  const changed = await reset.POST(request({ token, password: 'newer password', confirmPassword: 'newer password' }));
  assert.equal(changed.status, 400);
  assert.equal((await changed.json()).error, 'Tautan reset tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.');

  const employee = users.find((item) => item.id === 'employee');
  assert.equal(await service.requestPasswordReset('worker', now), true);
  const expiredEmployeeToken = new URL(sends.at(-1).url).searchParams.get('token');
  assert.equal(sends.at(-1).to, employee.email);
  assert.equal(await service.consumePasswordReset(expiredEmployeeToken, 'employee password', new Date(now.getTime() + 15 * 60 * 1000)), null);
  assert.equal(employee.password, 'hash');

  const employeeForgot = await forgot.POST(request({ identifier: 'WORKER@EXAMPLE.COM' }));
  assert.deepEqual(await employeeForgot.json(), genericBody);
  await afterJobs.shift()();
  const employeeToken = new URL(sends.at(-1).url).searchParams.get('token');
  assert.equal(sends.at(-1).to, employee.email);
  assert.notEqual(employeeToken, expiredEmployeeToken);
  assert.equal(await service.consumePasswordReset(expiredEmployeeToken, 'employee password'), null);
  const employeeResults = await Promise.all([
    reset.POST(request({ token: employeeToken, password: 'employee password', confirmPassword: 'employee password' })),
    reset.POST(request({ token: employeeToken, password: 'employee password', confirmPassword: 'employee password' })),
  ]);
  assert.deepEqual(employeeResults.map((result) => result.status).sort(), [200, 400]);
  await afterJobs.shift()();
  assert.deepEqual(sends.at(-1), { kind: 'changed', to: employee.email });
  assert.equal(employee.sessionVersion, 1);
  assert.equal(employee.passwordResetTokenHash, null);
  assert.equal(employee.passwordResetExpiresAt, null);
  assert.equal(await bcrypt.compare('employee password', employee.password), true);
  console.log('PASS: ADMIN/PEGAWAI recovery by username/email, generic responses, inactive/no-email guards, ambiguity, email cleanup, cooldown, origin, expiry, single-use, replacement rejection, password mismatch, session revocation, email/version CAS, and notification failure. Database and SMTP boundaries mocked.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
