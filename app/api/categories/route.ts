import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";

export const GET = withErrorHandler(async () => {
  await requireAuth();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return apiResponse(categories);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError("Nama kategori wajib diisi.", 400);
  }

  const trimmed = name.trim();

  const existing = await prisma.category.findUnique({
    where: { name: trimmed },
  });

  if (existing) {
    throw new ApiError(`Kategori "${trimmed}" sudah ada.`, 409);
  }

  const category = await prisma.category.create({
    data: { name: trimmed },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return apiResponse(category, 201, `Kategori "${trimmed}" berhasil dibuat.`);
});
