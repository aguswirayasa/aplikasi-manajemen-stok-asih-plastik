import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";

export const GET = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAuth();
  const { id } = await params;

  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    throw new ApiError("Kategori tidak ditemukan.", 404);
  }

  return apiResponse(category);
});

export const PUT = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError("Nama kategori wajib diisi.", 400);
  }

  const category = await prisma.category.update({
    where: { id },
    data: { name: name.trim() },
  });

  return apiResponse(category);
});

export const DELETE = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAuth();
  const { id } = await params;

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!category) {
    throw new ApiError("Kategori tidak ditemukan.", 404);
  }

  if (category._count.products > 0) {
    throw new ApiError("Kategori yang masih digunakan produk tidak bisa dihapus.", 409);
  }

  await prisma.category.delete({
    where: { id },
  });

  return apiResponse({ success: true });
});
