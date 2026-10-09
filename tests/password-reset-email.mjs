import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const sends = [];
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/email.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, {
  exports,
  process: { env: { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_USER: 'test', SMTP_PASSWORD: 'test', SMTP_FROM: 'Asih Plastik <test@example.com>' } },
  require(id) {
    assert.equal(id, 'nodemailer');
    return { createTransport: () => ({ sendMail: async mail => sends.push(mail) }) };
  },
});
const url = 'https://example.com/reset-password?token=abc&value="quoted"';
await exports.sendPasswordResetEmail('user@example.com', url);
const mail = sends[0];
assert.equal(mail.to, 'user@example.com');
assert.match(mail.text, /15 menit/);
assert.ok(mail.text.includes(url));
assert.match(mail.html, /lang="id"/);
for (const color of ['#fffefb', '#201515', '#c5c0b1', '#ff4f00']) assert.ok(mail.html.includes(color));
assert.match(mail.html, /Asih Plastik/);
assert.match(mail.html, /role="presentation"/);
assert.match(mail.html, /15 menit/);
assert.match(mail.html, /Abaikan email ini/);
assert.ok(mail.html.includes('href="https://example.com/reset-password?token=abc&amp;value=&quot;quoted&quot;"'));
assert.ok(!mail.html.includes(url));
console.log('PASS: branded reset email, expiry, fallback text, and escaped HTML link. SMTP mocked.');
