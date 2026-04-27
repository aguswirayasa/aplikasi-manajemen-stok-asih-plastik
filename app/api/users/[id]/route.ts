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

export const PUT = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const currentUser = await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  const { name, role, password, isActive } = body;

  if (typeof name !== "string" || !isUserRole(role)) {
    throw new ApiError("Nama dan role wajib diisi.", 400);
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    throw new ApiError("Status aktif user tidak valid.", 400);
  }

  if (id === currentUser.id && isActive === false) {
    throw new ApiError("Anda tidak bisa menonaktifkan akun sendiri.", 409);
  }

  const existingUser = await prisma.user.findUnique({ where: { id } });

  if (!existingUser) {
    throw new ApiError("User tidak ditemukan.", 404);
  }

  const nextIsActive = isActive ?? existingUser.isActive;
  const nextRole = role;

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
    password?: string;
  } = {
    name,
    role: nextRole,
    isActive: nextIsActive,
  };
  
  if (typeof password === "string" && password.length > 0) {
    dataToUpdate.password = await bcrypt.hash(password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: dataToUpdate,
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    }
  });

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
    data: { isActive: false },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return apiResponse(user, 200, "User berhasil dinonaktifkan.");
});
