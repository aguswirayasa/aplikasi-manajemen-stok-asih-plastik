import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ApiError, apiResponse, requireAdmin, withErrorHandler } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";
import { isUserRole } from "@/lib/user-roles";
import { normalizeRecoveryEmail, validateNewPassword } from "@/lib/password-validation";

export const GET = withErrorHandler(async () => {
  await requireAdmin();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      email: true,
      createdAt: true
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }]
  });
  return apiResponse(users);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("Data user tidak valid.", 400);
  }
  const { username, name, password, role } = body;

  if (
    typeof username !== "string" ||
    typeof name !== "string" ||
    typeof password !== "string" ||
    !isUserRole(role)
  ) {
    throw new ApiError("Username, nama, password, dan role wajib diisi.", 400);
  }

  const email = Object.prototype.hasOwnProperty.call(body, "email")
    ? normalizeRecoveryEmail(body.email)
    : undefined;

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    throw new ApiError("Username sudah digunakan.", 409);
  }

  if (email && await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new ApiError("Email pemulihan sudah digunakan.", 409);
  }

  const hashedPassword = await bcrypt.hash(validateNewPassword(password), 10);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        username,
        name,
        password: hashedPassword,
        role,
        email,
        isActive: true
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        email: true,
        createdAt: true
      }
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const target = "meta" in error && typeof error.meta === "object" && error.meta !== null && "target" in error.meta
        ? error.meta.target
        : undefined;
      const fields = Array.isArray(target) ? target.join(" ") : String(target ?? "");
      if (fields.includes("email")) {
        throw new ApiError("Email pemulihan sudah digunakan.", 409);
      }
      throw new ApiError("Username sudah digunakan.", 409);
    }
    throw error;
  }

  return apiResponse(user, 201);
});
