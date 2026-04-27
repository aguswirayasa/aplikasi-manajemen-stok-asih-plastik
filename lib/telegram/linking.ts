import { createHash, randomBytes } from "crypto";
import { ApiError } from "@/lib/api-helpers";
import prisma from "@/lib/prisma";
import { getTelegramLinkTtlMinutes } from "@/lib/telegram/config";
import type { TelegramMessage } from "@/lib/telegram/types";

export function normalizeTelegramChatId(chatId: string | number) {
  return String(chatId);
}

export function hashTelegramLinkToken(token: string) {
  return createHash("sha256")
    .update(token.trim().toUpperCase())
    .digest("hex");
}

export async function createTelegramLinkToken(userId: string) {
  const ttlMinutes = getTelegramLinkTtlMinutes();
  const token = randomBytes(5).toString("hex").toUpperCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  await prisma.telegramLinkToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { userId, usedAt: null },
      ],
    },
  });

  await prisma.telegramLinkToken.create({
    data: {
      tokenHash: hashTelegramLinkToken(token),
      userId,
      expiresAt,
    },
  });

  return {
    token,
    command: `/link ${token}`,
    expiresAt,
    ttlMinutes,
  };
}

export async function getTelegramLinkStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      telegramChatId: true,
      telegramUsername: true,
      telegramLinkedAt: true,
    },
  });

  if (!user) {
    throw new ApiError("User tidak ditemukan.", 404);
  }

  return {
    linked: Boolean(user.telegramChatId),
    telegramUsername: user.telegramUsername,
    telegramLinkedAt: user.telegramLinkedAt,
  };
}

export async function unlinkTelegramUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkedAt: null,
    },
  });
}

export async function linkTelegramChat(token: string, message: TelegramMessage) {
  const now = new Date();
  const tokenHash = hashTelegramLinkToken(token);
  const chatId = normalizeTelegramChatId(message.chat.id);
  const telegramUsername = message.from?.username || message.chat.username || null;

  return prisma.$transaction(async (tx) => {
    const linkToken = await tx.telegramLinkToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!linkToken || linkToken.usedAt || linkToken.expiresAt <= now) {
      throw new ApiError("Kode link tidak valid atau sudah kedaluwarsa.", 400);
    }

    if (!linkToken.user.isActive) {
      throw new ApiError("Akun webapp tidak aktif.", 403);
    }

    const consumedToken = await tx.telegramLinkToken.updateMany({
      where: {
        id: linkToken.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (consumedToken.count === 0) {
      throw new ApiError("Kode link sudah dipakai.", 409);
    }

    await tx.user.updateMany({
      where: {
        telegramChatId: chatId,
        id: { not: linkToken.userId },
      },
      data: {
        telegramChatId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
      },
    });

    await tx.user.update({
      where: { id: linkToken.userId },
      data: {
        telegramChatId: chatId,
        telegramUsername,
        telegramLinkedAt: now,
      },
    });

    return linkToken.user;
  });
}

export async function findUserByTelegramChat(chatId: string) {
  return prisma.user.findUnique({
    where: { telegramChatId: chatId },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      isActive: true,
    },
  });
}

export async function unlinkTelegramChat(chatId: string) {
  const user = await findUserByTelegramChat(chatId);

  if (!user) {
    return null;
  }

  await unlinkTelegramUser(user.id);

  return user;
}
