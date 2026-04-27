import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();

  const typeId = req.nextUrl.searchParams.get("typeId");

  const values = await prisma.variationValue.findMany({
    where: typeId ? { variationTypeId: typeId } : undefined,
    include: {
      variationType: { select: { name: true } },
      _count: { select: { productVariantValues: true } },
    },
    orderBy: { value: "asc" },
  });

  return apiResponse(values);
});

export const POST = withErrorHandler(async (req: Request) => {
  await requireAdmin();

  const body = await req.json();
  const { value, variationTypeId } = body;

  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError("Nilai variasi wajib diisi.", 400);
  }
  if (!variationTypeId || typeof variationTypeId !== "string") {
    throw new ApiError("Tipe variasi wajib diisi.", 400);
  }

  const trimmed = value.trim();

  const type = await prisma.variationType.findUnique({
    where: { id: variationTypeId },
  });
  if (!type) {
    throw new ApiError("Tipe variasi tidak ditemukan.", 404);
  }

  const existing = await prisma.variationValue.findUnique({
    where: { variationTypeId_value: { variationTypeId, value: trimmed } },
  });
  if (existing) {
    throw new ApiError(
      `Nilai "${trimmed}" sudah ada di tipe "${type.name}".`,
      409
    );
  }

  const variationValue = await prisma.variationValue.create({
    data: { value: trimmed, variationTypeId },
    include: { variationType: { select: { name: true } } },
  });

  return apiResponse(
    variationValue,
    201,
    `Nilai "${trimmed}" berhasil ditambahkan.`
  );
});
