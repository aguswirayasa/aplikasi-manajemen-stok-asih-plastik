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

  const type = await prisma.variationType.findUnique({
    where: { id },
    include: {
      values: { orderBy: { value: "asc" } },
      _count: { select: { productVariationTypes: true } },
    },
  });

  if (!type) {
    throw new ApiError("Tipe variasi tidak ditemukan.", 404);
  }

  return apiResponse(type);
});

export const PUT = withErrorHandler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError("Nama tipe variasi wajib diisi.", 400);
  }

  const trimmed = name.trim();

  const existing = await prisma.variationType.findFirst({
    where: { name: trimmed, NOT: { id } },
  });
  if (existing) {
    throw new ApiError(`Tipe variasi "${trimmed}" sudah ada.`, 409);
  }

  const updated = await prisma.variationType.update({
    where: { id },
    data: { name: trimmed },
    include: { values: true },
  });

  return apiResponse(updated, 200, `Tipe variasi diperbarui menjadi "${trimmed}".`);
});

export const DELETE = withErrorHandler(async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAdmin();
  const { id } = await params;

  const usageCount = await prisma.productVariationType.count({
    where: { variationTypeId: id },
  });

  if (usageCount > 0) {
    throw new ApiError(
      `Tidak bisa dihapus: tipe variasi ini digunakan oleh ${usageCount} produk.`,
      409
    );
  }

  await prisma.variationType.delete({ where: { id } });

  return apiResponse(null, 200, "Tipe variasi berhasil dihapus.");
});
