import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  withErrorHandler,
} from "@/lib/api-helpers";
import bcrypt from "bcryptjs";
import type { Role } from "@/generated/prisma/client";
import { isUserRole } from "@/lib/user-roles";
import { normalizeRecoveryEmail, validateNewPassword } from "@/lib/password-validation";

export const PUT = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const currentUser = await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("Data user tidak valid.", 400);
  }
  const { username, name, role, password, isActive } = body;

  if (typeof name !== "string" || !isUserRole(role)) {
    throw new ApiError("Nama dan role wajib diisi.", 400);
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    throw new ApiError("Status aktif user tidak valid.", 400);
  }

  if (username !== undefined && (typeof username !== "string" || !username.trim())) {
    throw new ApiError("Username wajib diisi.", 400);
  }

  if (id === currentUser.id && isActive === false) {
    throw new ApiError("Anda tidak bisa menonaktifkan akun sendiri.", 409);
  }

  const existingUser = await prisma.user.findUnique({ where: { id } });

  if (!existingUser) {
    throw new ApiError("User tidak ditemukan.", 404);
  }

  const nextUsername = typeof username === "string" ? username.trim() : undefined;
  if (nextUsername && nextUsername !== existingUser.username) {
    const usernameOwner = await prisma.user.findUnique({ where: { username: nextUsername } });
    if (usernameOwner && usernameOwner.id !== id) throw new ApiError("Username sudah digunakan.", 409);
  }

  const nextIsActive = isActive ?? existingUser.isActive;
  const nextRole = role;

  let nextEmail = existingUser.email;
  const emailChanged = Object.prototype.hasOwnProperty.call(body, "email")
    ? (nextEmail = normalizeRecoveryEmail(body.email)) !== existingUser.email
    : false;

  if (emailChanged) {
    if (id !== currentUser.id && existingUser.role !== "PEGAWAI") {
      throw new ApiError("Email pemulihan hanya dapat diubah oleh pemilik akun.", 403);
    }
    if (id === currentUser.id && (typeof body.currentPassword !== "string" || !(await bcrypt.compare(body.currentPassword, existingUser.password)))) {
      throw new ApiError("Password saat ini tidak sesuai.", 400);
    }
    if (nextEmail) {
      const emailOwner = await prisma.user.findUnique({ where: { email: nextEmail }, select: { id: true } });
      if (emailOwner && emailOwner.id !== id) {
        throw new ApiError("Email pemulihan sudah digunakan.", 409);
      }
    }
  }

  if (
    existingUser.role === "ADMIN" &&
    existingUser.isActive &&
    (nextRole !== "ADMIN" || !nextIsActive)
  ) {
    const activeAdminCount = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });

    if (activeAdminCount <= 1) {
      throw new ApiError("Minimal harus ada satu admin aktif.", 409);
    }
  }

  const dataToUpdate: {
    name: string;
    role: Role;
    isActive: boolean;
    username?: string;
    password?: string;
    email?: string | null;
    passwordResetTokenHash?: null;
    passwordResetExpiresAt?: null;
    sessionVersion?: { increment: number };
  } = {
    name,
    role: nextRole,
    isActive: nextIsActive,
  };

  if (nextUsername !== undefined) dataToUpdate.username = nextUsername;
  if (emailChanged) dataToUpdate.email = nextEmail;
  if (password !== undefined && typeof password !== "string") {
    throw new ApiError("Password baru tidak valid.", 400);
  }
  if (typeof password === "string" && password.length > 0) {
    dataToUpdate.password = await bcrypt.hash(validateNewPassword(password), 10);
    dataToUpdate.sessionVersion = { increment: 1 };
    dataToUpdate.passwordResetTokenHash = null;
    dataToUpdate.passwordResetExpiresAt = null;
  }
  if (emailChanged || !nextIsActive || (existingUser.role === "ADMIN" && nextRole !== "ADMIN")) {
    dataToUpdate.passwordResetTokenHash = null;
    dataToUpdate.passwordResetExpiresAt = null;
  }

  try {
    const result = await prisma.user.updateMany({
      where: {
        id,
        sessionVersion: existingUser.sessionVersion,
        email: existingUser.email,
        role: existingUser.role,
        isActive: existingUser.isActive,
        password: existingUser.password,
      },
      data: dataToUpdate,
    });
    if (result.count !== 1) {
      throw new ApiError("Data user berubah. Muat ulang halaman lalu coba lagi.", 409);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (typeof error === "object" && error !== null && "code" in error) {
      const target = "meta" in error && typeof error.meta === "object" && error.meta !== null && "target" in error.meta
        ? error.meta.target
        : undefined;
      const fields = Array.isArray(target) ? target.join(" ") : String(target ?? "");
      if (error.code === "P2002" && fields.includes("email")) {
        throw new ApiError("Email pemulihan sudah digunakan.", 409);
      }
      if (error.code === "P2002" && fields.includes("username")) {
        throw new ApiError("Username sudah digunakan.", 409);
      }
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, name: true, role: true, isActive: true, email: true, createdAt: true },
  });
  if (!user) throw new ApiError("User tidak ditemukan.", 404);

  return apiResponse(user);
});

export const DELETE = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const currentUser = await requireAdmin();
  const { id } = await params;

  if (id === currentUser.id) {
    throw new ApiError("Anda tidak bisa menonaktifkan akun sendiri.", 409);
  }
  
  const userToDelete = await prisma.user.findUnique({ where: { id } });

  if (!userToDelete) {
    throw new ApiError("User tidak ditemukan.", 404);
  }

  if (userToDelete.role === "ADMIN" && userToDelete.isActive) {
    const activeAdminCount = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });

    if (activeAdminCount <= 1) {
      throw new ApiError("Minimal harus ada satu admin aktif.", 409);
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false, passwordResetTokenHash: null, passwordResetExpiresAt: null },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      email: true,
      createdAt: true,
    },
  });

  return apiResponse(user, 200, "User berhasil dinonaktifkan.");
});
