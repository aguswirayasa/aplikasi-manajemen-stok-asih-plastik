import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const fromProject = createRequire(`${process.cwd()}/package.json`);
const ts = fromProject('typescript');
const prisma = { user: {} };
const userRoles = fromProject('./lib/user-roles.ts');
const bcrypt = fromProject('bcryptjs');
class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const helpers = {
  ApiError,
  apiResponse(data, status = 200, message) { return Response.json({ success: true, data, message }, { status }); },
  apiError(error, status = 400) { return Response.json({ success: false, error }, { status }); },
  withErrorHandler(handler) { return async (...args) => { try { return await handler(...args); } catch (error) { return helpers.apiError(error.message, error.status ?? 500); } }; },
};

const target = { id: 'user-1', username: 'old-name', name: 'Staff', role: 'PEGAWAI', isActive: true, password: 'hash', email: 'old@example.com', passwordResetTokenHash: 'reset-hash', passwordResetExpiresAt: new Date('2025-01-01'), sessionVersion: 2 };
let duplicateUsername = null;
let failUpdateWithUnique = false;
let uniqueTarget = ['username'];
let updateCalls = [];
let currentAdmin = { id: 'admin-1', role: 'ADMIN' };
let beforeNextUpdate = null;
prisma.user.findUnique = async ({ where }) => {
  if (where.id === target.id) return { ...target };
  if (typeof where.username === 'string' && where.username.toLowerCase() === target.username.toLowerCase()) return { ...target };
  if (where.username === duplicateUsername) return { id: 'user-2', username: duplicateUsername };
  if (where.email === duplicateEmail) return { id: 'user-2', email: duplicateEmail };
  return null;
};
prisma.user.count = async () => 2;
prisma.user.updateMany = async ({ where, data }) => {
  updateCalls.push({ where, data });
  if (failUpdateWithUnique) throw Object.assign(new Error('unique collision'), { code: 'P2002', meta: { target: uniqueTarget } });
  if (beforeNextUpdate) {
    const before = beforeNextUpdate;
    beforeNextUpdate = null;
    await before();
  }
  if (where.sessionVersion !== undefined && where.sessionVersion !== target.sessionVersion) return { count: 0 };
  if (Object.prototype.hasOwnProperty.call(where, 'email') && where.email !== target.email) return { count: 0 };
  if (where.role !== undefined && where.role !== target.role) return { count: 0 };
  if (where.isActive !== undefined && where.isActive !== target.isActive) return { count: 0 };
  if (where.password !== undefined && where.password !== target.password) return { count: 0 };
  const { sessionVersion, ...ordinaryFields } = data;
  Object.assign(target, ordinaryFields);
  if (sessionVersion?.increment) target.sessionVersion += sessionVersion.increment;
  return { count: 1 };
};
prisma.user.update = async ({ where, data }) => {
  assert.equal(where.id, target.id);
  Object.assign(target, data);
  return { id: target.id, username: target.username, name: target.name, role: target.role, isActive: target.isActive, email: target.email, createdAt: new Date('2025-01-01') };
};
let duplicateEmail = null;


const source = process.env.USER_UPDATE_BASELINE === '1'
  ? execFileSync('git', ['show', 'HEAD:app/api/users/[id]/route.ts'], { encoding: 'utf8' })
  : fs.readFileSync('app/api/users/[id]/route.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const routeExports = {};
vm.runInNewContext(compiled, {
  exports: routeExports,
  require(id) {
    if (id === '@/lib/prisma') return { __esModule: true, default: prisma };
    if (id === '@/lib/api-helpers') return { ...helpers, requireAdmin: async () => { if (!currentAdmin) throw new ApiError('Unauthorized', 401); if (currentAdmin.role !== 'ADMIN') throw new ApiError('Forbidden', 403); return currentAdmin; } };
    if (id === '@/lib/user-roles') return userRoles;
    if (id === '@/lib/password-validation') return {
      validateNewPassword(value) {
        if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) throw new ApiError('Password baru minimal 8 karakter dan maksimal 72 byte.', 400);
        return value;
      },
      normalizeRecoveryEmail(value) {
        if (value === null) return null;
        if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new ApiError('Email pemulihan tidak valid.', 400);
        return value.trim().toLowerCase();
      },
    };
    if (id === 'bcryptjs') return { __esModule: true, default: bcrypt };
    throw new Error(`Unexpected route dependency: ${id}`);
  },
  console: { error() {} },
  process,
});

function request(body) { return { json: async () => body }; }
async function put(body, id = target.id) {
  return routeExports.PUT(request(body), { params: Promise.resolve({ id }) });
}
async function main() {
  const renamed = await put({ username: '  new-name  ', name: 'Staff', role: 'PEGAWAI' });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).data.username, 'new-name');
  assert.equal(target.id, 'user-1');
  assert.equal(target.password, 'hash');
  assert.equal(updateCalls.at(-1).where.id, 'user-1');
  assert.equal(updateCalls.at(-1).data.username, 'new-name');

  duplicateUsername = null;
  const sameUserCaseChange = await put({ username: 'NEW-NAME', name: 'Staff', role: 'PEGAWAI' });
  assert.equal(sameUserCaseChange.status, 200);
  assert.equal(target.id, 'user-1');

  const beforeInvalid = updateCalls.length;
  const nonString = await put({ username: 17, name: 'Staff', role: 'PEGAWAI' });
  assert.equal(nonString.status, 400);
  const blank = await put({ username: '   ', name: 'Staff', role: 'PEGAWAI' });
  assert.equal(blank.status, 400);
  assert.equal(updateCalls.length, beforeInvalid);

  duplicateUsername = 'taken';
  const duplicate = await put({ username: 'taken', name: 'Staff', role: 'PEGAWAI' });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error, 'Username sudah digunakan.');
  duplicateUsername = null;

  failUpdateWithUnique = true;
  const race = await put({ username: 'raced', name: 'Staff', role: 'PEGAWAI' });
  assert.equal(race.status, 409);
  failUpdateWithUnique = false;

  target.isActive = false;
  const reactivated = await put({ name: 'Staff', role: 'PEGAWAI', isActive: true });
  assert.equal(target.isActive, true);
  assert.equal(reactivated.status, 200);
  assert.equal(updateCalls.at(-1).data.username, undefined);

  const hashedPassword = await put({ username: 'NEW-NAME', name: 'Staff', role: 'PEGAWAI', password: 'next-password' });
  assert.equal(hashedPassword.status, 200);
  assert.equal(await bcrypt.compare('next-password', target.password), true);
  assert.equal(updateCalls.at(-1).data.sessionVersion.increment, 1);
  assert.equal(target.sessionVersion, 3);
  assert.equal(updateCalls.at(-1).data.passwordResetTokenHash, null);
  assert.equal(updateCalls.at(-1).data.passwordResetExpiresAt, null);

  const employeePassword = target.password;
  const employeeVersion = target.sessionVersion;
  const employeeEmail = await put({ name: 'Staff', role: 'PEGAWAI', email: ' STAFF@Example.com ' });
  assert.equal(employeeEmail.status, 200);
  assert.equal(target.email, 'staff@example.com');
  assert.equal(target.password, employeePassword);
  assert.equal(target.sessionVersion, employeeVersion);
  assert.equal(target.passwordResetTokenHash, null);
  duplicateEmail = 'taken@example.com';
  const beforeEmployeeInvalid = updateCalls.length;
  for (const [email, status] of [['invalid', 400], ['taken@example.com', 409]]) {
    assert.equal((await put({ name: 'Should Not Save', role: 'PEGAWAI', email })).status, status);
    assert.equal(target.name, 'Staff');
    assert.equal(target.email, 'staff@example.com');
  }
  assert.equal(updateCalls.length, beforeEmployeeInvalid);
  duplicateEmail = null;
  assert.equal((await put({ name: 'Staff', role: 'PEGAWAI', email: null })).status, 200);
  assert.equal(target.email, null);

  target.password = await bcrypt.hash('current-password', 10);
  Object.assign(target, { role: 'ADMIN', isActive: true });
  currentAdmin = { id: target.id, role: 'ADMIN' };
  const emailEdit = await put({ name: 'Staff', role: 'ADMIN', email: '  NEW@Example.com ', currentPassword: 'current-password' });
  assert.equal(emailEdit.status, 200);
  assert.equal(target.email, 'new@example.com');
  assert.equal(updateCalls.at(-1).data.email, 'new@example.com');
  assert.equal(updateCalls.at(-1).data.passwordResetTokenHash, null);
  assert.equal(updateCalls.at(-1).data.passwordResetExpiresAt, null);

  const unchangedEmail = await put({ name: 'Staff', role: 'ADMIN', email: 'NEW@example.com' });
  assert.equal(unchangedEmail.status, 200);
  assert.equal(target.email, 'new@example.com');

  const beforeBadEmail = updateCalls.length;
  for (const [body, expectedStatus] of [
    [{ name: 'Changed', role: 'ADMIN', email: 'not-an-email', currentPassword: 'current-password' }, 400],
    [{ name: 'Changed', role: 'ADMIN', email: 'taken@example.com', currentPassword: 'current-password' }, 409],
    [{ name: 'Changed', role: 'ADMIN', email: 'next@example.com' }, 400],
    [{ name: 'Changed', role: 'ADMIN', email: 'next@example.com', currentPassword: 'wrong-password' }, 400],
  ]) {
    duplicateEmail = 'taken@example.com';
    const result = await put(body);
    assert.equal(result.status, expectedStatus);
    assert.equal(target.name, 'Staff');
    assert.equal(target.email, 'new@example.com');
  }
  duplicateEmail = null;
  assert.equal(updateCalls.length, beforeBadEmail);

  const emailClear = await put({ name: 'Staff', role: 'ADMIN', email: null, currentPassword: 'current-password' });
  assert.equal(emailClear.status, 200);
  assert.equal(target.email, null);

  const beforeForeignEmail = updateCalls.length;
  currentAdmin = { id: 'other-admin', role: 'ADMIN' };
  const foreignEmail = await put({ name: 'Staff', role: 'ADMIN', email: 'staff@example.com', currentPassword: 'current-password' });
  assert.equal(foreignEmail.status, 403);
  assert.equal(updateCalls.length, beforeForeignEmail);
  currentAdmin = { id: target.id, role: 'ADMIN' };

  uniqueTarget = ['email'];
  failUpdateWithUnique = true;
  const emailRace = await put({ name: 'Staff', role: 'ADMIN', email: 'race@example.com', currentPassword: 'current-password' });
  assert.equal(emailRace.status, 409);
  assert.equal((await emailRace.json()).error, 'Email pemulihan sudah digunakan.');
  assert.equal(target.email, null);
  failUpdateWithUnique = false;
  uniqueTarget = ['username'];

  currentAdmin = { id: 'other-admin', role: 'ADMIN' };
  Object.assign(target, { role: 'ADMIN', isActive: true, passwordResetTokenHash: 'demotion-hash', passwordResetExpiresAt: new Date() });
  const demoted = await put({ name: 'Staff', role: 'PEGAWAI' });
  assert.equal(demoted.status, 200);
  assert.equal(updateCalls.at(-1).data.passwordResetTokenHash, null);
  assert.equal(updateCalls.at(-1).data.passwordResetExpiresAt, null);
  Object.assign(target, { role: 'ADMIN', passwordResetTokenHash: 'deactivation-hash', passwordResetExpiresAt: new Date() });
  const deactivated = await routeExports.DELETE(request(null), { params: Promise.resolve({ id: target.id }) });
  assert.equal(deactivated.status, 200);
  assert.equal(target.isActive, false);
  assert.equal(target.passwordResetTokenHash, null);
  assert.equal(target.passwordResetExpiresAt, null);
  currentAdmin = { id: target.id, role: 'ADMIN' };
  const reactivatedAgain = await put({ name: 'Staff', role: 'ADMIN', isActive: true });
  assert.equal(reactivatedAgain.status, 200);

  const nameBeforeRace = target.name;
  const emailBeforeRace = target.email;
  beforeNextUpdate = async () => {
    target.sessionVersion += 1;
    target.password = await bcrypt.hash('concurrent-password', 10);
  };
  const staleCurrentPassword = await put({ name: 'Should Not Save', role: 'ADMIN', email: 'stale@example.com', currentPassword: 'current-password' });
  assert.equal(staleCurrentPassword.status, 409);
  assert.equal(target.name, nameBeforeRace);
  assert.equal(target.email, emailBeforeRace);

  const beforeShortPassword = updateCalls.length;
  const shortPassword = await put({ name: 'Staff', role: 'ADMIN', password: 'short' });
  assert.equal(shortPassword.status, 400);
  assert.equal(updateCalls.length, beforeShortPassword);

  const selfDeactivate = await put({ name: 'Admin', role: 'ADMIN', isActive: false }, currentAdmin.id);
  assert.equal(selfDeactivate.status, 409);
  currentAdmin = { id: 'other-admin', role: 'ADMIN' };
  Object.assign(target, { role: 'ADMIN', isActive: true });
  prisma.user.count = async () => 1;
  const lastAdmin = await put({ name: 'Staff', role: 'PEGAWAI', isActive: true });
  assert.equal(lastAdmin.status, 409);

  currentAdmin = null;
  const unauthorized = await put({ username: 'unauthorized', name: 'Staff', role: 'PEGAWAI' });
  assert.equal(unauthorized.status, 401);
  currentAdmin = { id: 'user-1', role: 'PEGAWAI' };
  const forbidden = await put({ username: 'forbidden', name: 'Staff', role: 'PEGAWAI' });
  assert.equal(forbidden.status, 403);
  console.log('PASS: PUT rename, normalization, blank/non-string/duplicate/race conflicts, reactivation, password update, and admin safeguards. Database boundary mocked.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
