import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/package.json`);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, TextEncoder, console,
    require(id) {
      if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (id === 'next-auth/react') return { signOut: async () => {} };
      if (id.startsWith('@/')) {
        const path = id.replace('@/', '');
        const extension = ['.tsx', '.ts'].find(ext => fs.existsSync(path + ext));
        return load(path + extension);
      }
      return require(id);
    },
  });
  cache.set(file, exports);
  return exports;
}
const { ForgotPasswordForm } = load('components/auth/ForgotPasswordForm.tsx');
const { ResetPasswordForm } = load('components/auth/ResetPasswordForm.tsx');
const forgot = renderToStaticMarkup(React.createElement(ForgotPasswordForm));
assert.match(forgot, /Username atau email/);
assert.match(forgot, /Admin dan pegawai/);
assert.match(forgot, /maxLength="254"/);
assert.match(forgot, /href="\/login"/);
for (const token of [null, '', 'wrong', 'a'.repeat(63), 'z'.repeat(64)]) {
  const invalid = renderToStaticMarkup(React.createElement(ResetPasswordForm, { token }));
  assert.match(invalid, /Tautan reset tidak valid/);
  assert.doesNotMatch(invalid, /type="password"/);
  assert.match(invalid, /href="\/forgot-password"/);
}
const valid = renderToStaticMarkup(React.createElement(ResetPasswordForm, { token: 'a'.repeat(64) }));
assert.match(valid, /Password baru/);
assert.match(valid, /Konfirmasi password/);
assert.equal((valid.match(/autoComplete="new-password"/g) || []).length, 2);
assert.doesNotMatch(valid, /a{64}/);
console.log('PASS: recovery form labels, identifier bounds, invalid token states, password inputs, and no token in visible markup.');
