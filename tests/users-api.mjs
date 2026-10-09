import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/package.json`);
const ts = require('typescript');
class ApiError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const helpers = {
  ApiError,
  apiResponse(data, status = 200, message) { return Response.json({ success: true, data, message }, { status }); },
  apiError(error, status = 400) { return Response.json({ success: false, error }, { status }); },
  withErrorHandler(handler) { return async (...args) => { try { return await handler(...args); } catch (error) { return helpers.apiError(error.message, error.status ?? 500); } }; },
};

let admin = { id: 'admin-1', role: 'ADMIN' };
const created = [];
let listOptions;
let duplicateEmail = null;
let uniqueTarget = null;
const prisma = { user: {
  async findMany(options) {
    listOptions = options;
    return [{ id: 'admin-1', username: 'admin', name: 'Admin', role: 'ADMIN', isActive: true, email: 'owner@example.com', createdAt: new Date() }];
  },
  async findUnique({ where }) { return where.email && where.email === duplicateEmail ? { id: 'existing-user' } : null; },
  async create(options) {
    if (uniqueTarget) throw Object.assign(new Error('unique conflict'), { code: 'P2002', meta: { target: uniqueTarget } });
    created.push(options);
    const row = { id: 'new-user', ...options.data, email: options.data.email ?? null, createdAt: new Date() };
    return Object.fromEntries(Object.keys(options.select).map(key => [key, row[key]]));
  },
} };
const passwordValidation = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/password-validation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: passwordValidation, Buffer, require: () => ({ ApiError }) });

function loadRoute() {
  const source = fs.readFileSync('app/api/users/route.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(id) {
      if (id === '@/lib/prisma') return { __esModule: true, default: prisma };
      if (id === '@/lib/api-helpers') return { ...helpers, requireAdmin: async () => { if (!admin) throw new ApiError('Unauthorized', 401); if (admin.role !== 'ADMIN') throw new ApiError('Forbidden', 403); return admin; } };
      if (id === 'bcryptjs') return { __esModule: true, default: { hash: async (value) => `hash:${value}` } };
      if (id === '@/lib/user-roles') return { isUserRole: (role) => ['ADMIN', 'PEGAWAI'].includes(role) };
      if (id === '@/lib/password-validation') return passwordValidation;
      throw new Error(`Unexpected dependency: ${id}`);
    },
  }, { filename: 'app/api/users/route.ts' });
  return exports;
}

async function main() {
  const routes = loadRoute();
  const listed = await routes.GET();
  assert.equal(listed.status, 200);
  assert.equal(listOptions.select.email, true);
  for (const sensitive of ['password', 'passwordResetTokenHash', 'passwordResetExpiresAt', 'sessionVersion']) {
    assert.equal(listOptions.select[sensitive], undefined);
  }
  assert.equal((await listed.json()).data[0].email, 'owner@example.com');

  const request = (body) => ({ json: async () => body });
  const tooShort = await routes.POST(request({ username: 'staff', name: 'Staff', role: 'PEGAWAI', password: 'short' }));
  assert.equal(tooShort.status, 400);
  assert.equal(created.length, 0);

  const malformedShape = await routes.POST(request(null));
  assert.equal(malformedShape.status, 400);
  assert.equal(created.length, 0);

  const response = await routes.POST(request({ username: 'staff', name: 'Staff', role: 'PEGAWAI', password: 'long-enough', email: ' STAFF@Example.com ' }));
  assert.equal(response.status, 201);
  assert.equal(created[0].data.password, 'hash:long-enough');
  assert.equal(created[0].data.email, 'staff@example.com');
  assert.equal((await response.json()).data.email, 'staff@example.com');
  assert.equal(created[0].select.password, undefined);
  assert.equal(created[0].select.passwordResetTokenHash, undefined);
  assert.equal(created[0].select.passwordResetExpiresAt, undefined);
  assert.equal(created[0].select.sessionVersion, undefined);
  const newAdmin = await routes.POST(request({ username: 'new-admin', name: 'Admin', role: 'ADMIN', password: 'long-enough', email: ' ADMIN@example.com ' }));
  assert.equal(newAdmin.status, 201);
  assert.equal((await newAdmin.json()).data.email, 'admin@example.com');
  assert.equal(created.at(-1).data.role, 'ADMIN');
  for (const email of [undefined, null]) {
    const withoutEmail = await routes.POST(request({ username: 'optional-email', name: 'Staff', role: 'PEGAWAI', password: 'long-enough', ...(email === undefined ? {} : { email }) }));
    assert.equal(withoutEmail.status, 201);
    assert.equal((await withoutEmail.json()).data.email, null);
  }
  const beforeInvalidEmail = created.length;
  for (const email of ['invalid', 42, 'name<admin@example.com>']) {
    assert.equal((await routes.POST(request({ username: 'invalid-email', name: 'Staff', role: 'PEGAWAI', password: 'long-enough', email }))).status, 400);
  }
  duplicateEmail = 'taken@example.com';
  assert.equal((await routes.POST(request({ username: 'duplicate', name: 'Staff', role: 'ADMIN', password: 'long-enough', email: 'TAKEN@example.com' }))).status, 409);
  duplicateEmail = null;
  assert.equal(created.length, beforeInvalidEmail);
  for (const field of ['email', 'username']) {
    uniqueTarget = [field];
    const conflict = await routes.POST(request({ username: 'racing', name: 'Staff', role: 'PEGAWAI', password: 'long-enough', email: 'race@example.com' }));
    assert.equal(conflict.status, 409);
    assert.match((await conflict.json()).error, field === 'email' ? /Email/ : /Username/);
  }
  uniqueTarget = null;
  admin = { id: 'employee', role: 'PEGAWAI' };
  assert.equal((await routes.POST(request({ username: 'denied', name: 'Staff', role: 'PEGAWAI', password: 'long-enough', email: 'denied@example.com' }))).status, 403);
  admin = null;
  assert.equal((await routes.POST(request({ username: 'anonymous', name: 'Staff', role: 'ADMIN', password: 'long-enough' }))).status, 401);
  assert.equal(created.length, beforeInvalidEmail);
  console.log('PASS: safe user DTOs; admin-only creation with normalized optional email for both roles, validation and duplicate/race conflicts. Database boundary mocked.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
