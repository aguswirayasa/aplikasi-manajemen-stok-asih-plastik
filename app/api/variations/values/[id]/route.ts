import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAdmin,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";

export const GET = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAuth();
  const { id } = await params;

  const value = await prisma.variationValue.findUnique({
    where: { id },
    include: {
      variationType: true,
      _count: { select: { productVariantValues: true } },
    },
  });

  if (!value) {
    throw new ApiError("Nilai variasi tidak ditemukan.", 404);
  }

  return apiResponse(value);
});

export const PUT = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  const { value } = body;

  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError("Nilai variasi wajib diisi.", 400);
  }

  const trimmed = value.trim();

  const existing = await prisma.variationValue.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError("Nilai variasi tidak ditemukan.", 404);
  }

  const duplicate = await prisma.variationValue.findFirst({
    where: {
      variationTypeId: existing.variationTypeId,
      value: trimmed,
      NOT: { id },
    },
  });
  if (duplicate) {
    throw new ApiError(`Nilai "${trimmed}" sudah ada di tipe ini.`, 409);
  }

  const updated = await prisma.variationValue.update({
    where: { id },
    data: { value: trimmed },
    include: { variationType: { select: { name: true } } },
  });

  return apiResponse(updated, 200, `Nilai diperbarui menjadi "${trimmed}".`);
});

export const DELETE = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin();
  const { id } = await params;

  const usageCount = await prisma.productVariantValue.count({
    where: { variationValueId: id },
  });

  if (usageCount > 0) {
    throw new ApiError(
      `Tidak bisa dihapus: nilai ini digunakan oleh ${usageCount} SKU produk.`,
      409
    );
  }

  await prisma.variationValue.delete({ where: { id } });

  return apiResponse(null, 200, "Nilai variasi berhasil dihapus.");
});
