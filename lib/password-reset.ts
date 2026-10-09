import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { normalizeRecoveryEmail, validateNewPassword } from "@/lib/password-validation";
import { sendPasswordResetEmail } from "@/lib/email";

const RESET_LIFETIME_MS = 15 * 60 * 1000;
const ISSUANCE_COOLDOWN_MS = 60 * 1000;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function applicationOrigin() {
  const configuredUrl = process.env.NEXTAUTH_URL;
  if (!configuredUrl) throw new Error("Password recovery is unavailable.");

  const url = new URL(configuredUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("Password recovery is unavailable.");
  }

  return url.origin;
}

export function hasSameRecoveryOrigin(origin: string | null) {
  try {
    return Boolean(origin && new URL(origin).origin === applicationOrigin());
  } catch {
    return false;
  }
}

export async function requestPasswordReset(identifier: string, now = new Date()) {
  const usernameLookup = prisma.user.findUnique({
    where: { username: identifier },
    select: { id: true, username: true, password: true, role: true, isActive: true, email: true, sessionVersion: true },
  });
  let normalizedEmail: string | null = null;
  try {
    normalizedEmail = normalizeRecoveryEmail(identifier);
  } catch {
    // Identifier yang bukan format email tetap dapat dicocokkan sebagai username.
  }
  const emailLookup = normalizedEmail
    ? prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, username: true, password: true, role: true, isActive: true, email: true, sessionVersion: true },
      })
    : Promise.resolve(null);
  const [usernameUser, emailUser] = await Promise.all([usernameLookup, emailLookup]);

  if (usernameUser && emailUser && usernameUser.id !== emailUser.id) return false;
  const user = usernameUser ?? emailUser;
  if (!user || !user.isActive || !user.email) return false;

  const origin = applicationOrigin();
  const token = randomBytes(32).toString("hex");
  const hash = tokenHash(token);
  const expiresAt = new Date(now.getTime() + RESET_LIFETIME_MS);
  const cooldownCutoff = new Date(now.getTime() + RESET_LIFETIME_MS - ISSUANCE_COOLDOWN_MS);
  const issued = await prisma.user.updateMany({
    where: {
      id: user.id,
      username: user.username,
      password: user.password,
      sessionVersion: user.sessionVersion,
      email: user.email,
      role: user.role,
      isActive: true,
      OR: [
        { passwordResetExpiresAt: null },
        { passwordResetExpiresAt: { lte: cooldownCutoff } },
      ],
    },
    data: { passwordResetTokenHash: hash, passwordResetExpiresAt: expiresAt },
  });
  if (issued.count !== 1) return false;

  const resetUrl = new URL("/reset-password", origin);
  resetUrl.searchParams.set("token", token);
  try {
    await sendPasswordResetEmail(user.email, resetUrl.toString());
  } catch {
    try {
      await prisma.user.updateMany({
        where: { id: user.id, passwordResetTokenHash: hash },
        data: { passwordResetTokenHash: null, passwordResetExpiresAt: null },
      });
    } catch {
      // Kegagalan pembersihan tidak boleh membocorkan detail SMTP atau token.
    }
    throw new Error("Password recovery email delivery failed.");
  }

  return true;
}

export async function consumePasswordReset(token: string, password: unknown, now = new Date()) {
  const newPassword = validateNewPassword(password);
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;

  const hash = tokenHash(token);
  const user = await prisma.user.findUnique({
    where: { passwordResetTokenHash: hash },
    select: { id: true, email: true, role: true, isActive: true, sessionVersion: true },
  });
  if (!user || !user.email || !user.isActive) return null;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const reset = await prisma.user.updateMany({
    where: {
      id: user.id,
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: { gt: now },
      email: user.email,
      role: user.role,
      isActive: true,
      sessionVersion: user.sessionVersion,
    },
    data: {
      password: passwordHash,
      sessionVersion: { increment: 1 },
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
  return reset.count === 1 ? user.email : null;
}
