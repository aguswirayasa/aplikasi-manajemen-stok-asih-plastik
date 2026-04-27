import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ApiError, apiResponse, requireAdmin, withErrorHandler } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";
import { isUserRole } from "@/lib/user-roles";

export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAdmin();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
  });
  return apiResponse(users);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();
  const { username, name, password, role } = body;

  if (
    typeof username !== "string" ||
    typeof name !== "string" ||
    typeof password !== "string" ||
    !isUserRole(role)
  ) {
    throw new ApiError("Username, nama, password, dan role wajib diisi.", 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    throw new ApiError("Username sudah digunakan.", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      name,
      password: hashedPassword,
      role,
      isActive: true
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  return apiResponse(user, 201);
});
