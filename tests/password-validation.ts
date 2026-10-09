import assert from "node:assert/strict";
import { ApiError } from "../lib/api-helpers";
import { normalizeRecoveryEmail, validateNewPassword } from "../lib/password-validation";

assert.equal(validateNewPassword("12345678"), "12345678");
assert.equal(validateNewPassword(" pass 123 "), " pass 123 ");
assert.equal(validateNewPassword(`${"a".repeat(8)}${"é".repeat(32)}`).length, 40);
assert.throws(() => validateNewPassword("short"), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);
assert.throws(() => validateNewPassword("é".repeat(37)), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);

assert.equal(normalizeRecoveryEmail("  Admin@Example.COM  "), "admin@example.com");
assert.equal(normalizeRecoveryEmail("Admin+reports@Sub.Example.co"), "admin+reports@sub.example.co");
assert.equal(normalizeRecoveryEmail(null), null);
assert.throws(() => normalizeRecoveryEmail(12), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);
assert.throws(() => normalizeRecoveryEmail("bad address"), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);
assert.throws(() => normalizeRecoveryEmail("name<admin@example.com>"), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);
assert.throws(() => normalizeRecoveryEmail("admin,other@example.com"), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);
assert.throws(() => normalizeRecoveryEmail("admin;other@example.com"), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);
assert.throws(() => normalizeRecoveryEmail("admin@foo..com"), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);
assert.throws(() => normalizeRecoveryEmail(`${"a".repeat(246)}@example.com`), (error: unknown) =>
  error instanceof ApiError && error.status === 400
);

console.log("PASS: shared password and recovery-email validation assertions.");
