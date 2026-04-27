import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";

export const GET = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAuth();
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      variationTypes: {
        include: { variationType: true },
        orderBy: { sortOrder: "asc" },
      },
      variants: {
        include: {
          values: {
            include: {
              variationValue: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new ApiError("Produk tidak ditemukan.", 404);
  }

  return apiResponse(product);
});

export const PUT = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  const { name, categoryId, description } = body;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof categoryId !== "string"
  ) {
    throw new ApiError("Nama produk dan kategori wajib diisi.", 400);
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name.trim(),
      categoryId,
      description:
        typeof description === "string" && description.trim().length > 0
          ? description.trim()
          : null,
    },
  });

  return apiResponse(product);
});

export const DELETE = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin();
  const { id } = await params;

  await prisma.product.delete({
    where: { id },
  });

  return apiResponse({ success: true });
});
