import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/package.json`);
const ts = require('typescript');

function loadTypeScript(path, dependencies, globals = {}) {
  const source = fs.readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(id) {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    },
    ...globals,
  }, { filename: path });
  return exports;
}

let row = { id: 'admin-1', name: 'Admin', username: 'admin', role: 'ADMIN', isActive: true, sessionVersion: 4 };
const prisma = { user: { async findUnique() { return row ? { ...row } : null; } } };
const auth = loadTypeScript('lib/auth.ts', {
  'next-auth': {},
  'next-auth/providers/credentials': { __esModule: true, default: (options) => options },
  'bcryptjs': { __esModule: true, default: { compare: async () => true } },
  '@/lib/prisma': { __esModule: true, default: prisma },
}, { process });

async function main() {
  const callbacks = auth.authOptions.callbacks;
  const signedInToken = await callbacks.jwt({
    token: {},
    user: { ...row },
  });
  assert.equal(signedInToken.sessionVersion, 4);
  assert.equal(signedInToken.isActive, true);

  row.sessionVersion = 5;
  const revokedToken = await callbacks.jwt({ token: signedInToken });
  assert.equal(revokedToken.sessionVersion, 4, 'session reads must not refresh the captured version');
  assert.equal(revokedToken.isActive, false);

  const missingVersionToken = await callbacks.jwt({ token: { id: row.id } });
  assert.equal(missingVersionToken.isActive, false);

  row.sessionVersion = 4;
  row = null;
  const deletedUserToken = await callbacks.jwt({ token: signedInToken });
  assert.equal(deletedUserToken.isActive, false);
  row = { id: 'admin-1', name: 'Admin', username: 'admin', role: 'ADMIN', isActive: true, sessionVersion: 4 };

  const session = await callbacks.session({ session: { user: {} }, token: signedInToken });
  assert.equal(session.user.sessionVersion, 4);

  row = { id: 'employee-1', name: 'Pegawai', username: 'employee', role: 'PEGAWAI', isActive: true, sessionVersion: 0 };
  const employeeToken = await callbacks.jwt({ token: {}, user: { ...row } });
  assert.equal(employeeToken.isActive, true);
  row.sessionVersion++;
  assert.equal((await callbacks.jwt({ token: employeeToken })).isActive, false);
  assert.equal(employeeToken.sessionVersion, 0);
  row = { id: 'admin-1', name: 'Admin', username: 'admin', role: 'ADMIN', isActive: true, sessionVersion: 4 };

  let currentSession = { user: { ...session.user, isActive: false } };
  let loggedMessage;
  const apiAuth = loadTypeScript('lib/api-helpers.ts', {
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options.status }) } },
    'next-auth': { getServerSession: async () => currentSession },
    './auth': { authOptions: {} },
  }, { SyntaxError, console: { error(message) { loggedMessage = message; } } });
  await assert.rejects(apiAuth.requireAuth(), (error) => error.status === 401);
  currentSession = { user: { ...session.user, sessionVersion: undefined, isActive: true } };
  await assert.rejects(apiAuth.requireAuth(), (error) => error.status === 401);
  currentSession = { user: { ...session.user, isActive: true, sessionVersion: 4 } };
  assert.equal((await apiAuth.requireAuth()).id, 'admin-1');

  const malformed = await apiAuth.withErrorHandler(async () => { throw new SyntaxError('token=secret'); })();
  assert.equal(malformed.status, 400);
  assert.equal(malformed.data.error, 'Permintaan tidak valid.');
  const internal = await apiAuth.withErrorHandler(async () => { throw new Error('password=secret'); })();
  assert.equal(internal.status, 500);
  assert.equal(internal.data.error, 'Internal Server Error');
  assert.equal(loggedMessage, 'API Error: Internal Server Error');

  let redirectedTo;
  const pageAuth = loadTypeScript('lib/page-auth.ts', {
    'next-auth': { getServerSession: async () => currentSession },
    'next/navigation': {
      forbidden() { throw new Error('forbidden'); },
      redirect(path) { redirectedTo = path; throw new Error('redirect'); },
    },
    '@/lib/auth': { authOptions: {} },
  });
  currentSession = { user: { ...session.user, isActive: false, sessionVersion: 4 } };
  await assert.rejects(pageAuth.requirePageAuth(), /redirect/);
  assert.equal(redirectedTo, '/login');
  currentSession = { user: { ...session.user, isActive: true, sessionVersion: undefined } };
  await assert.rejects(pageAuth.requirePageAuth(), /redirect/);
  assert.equal(redirectedTo, '/login');

  const proxySource = fs.readFileSync('proxy.ts', 'utf8');
  assert.doesNotMatch(proxySource, /pathname === "\/login" && token/);
  assert.match(proxySource, /if \(req\.nextUrl\.pathname === "\/login"\)/);
  console.log('PASS: immutable JWT versions, server guards, sanitized errors, and stale-token login routing. Database boundary mocked.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
