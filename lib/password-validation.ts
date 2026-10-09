import { ApiError } from "@/lib/api-helpers";

export function validateNewPassword(password: unknown): string {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new ApiError("Password harus berisi minimal 8 karakter dan maksimal 72 byte.", 400);
  }

  return password;
}

export function normalizeRecoveryEmail(email: unknown): string | null {
  if (email === null) return null;
  if (typeof email !== "string") {
    throw new ApiError("Email pemulihan tidak valid.", 400);
  }

  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split("@");
  if (
    normalized.length > 254 ||
    normalized.split("@").length !== 2 ||
    !localPart ||
    localPart.length > 64 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart) ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain ?? "")
  ) {
    throw new ApiError("Email pemulihan tidak valid.", 400);
  }

  return normalized;
}
