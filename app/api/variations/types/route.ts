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

  const types = await prisma.variationType.findMany({
    include: {
      _count: { select: { values: true, productVariationTypes: true } },
      values: { orderBy: { value: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  return apiResponse(types);
});

export const POST = withErrorHandler(async (req: Request) => {
  await requireAdmin();

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError("Nama tipe variasi wajib diisi.", 400);
  }

  const trimmed = name.trim();

  const existing = await prisma.variationType.findUnique({
    where: { name: trimmed },
  });
  if (existing) {
    throw new ApiError(`Tipe variasi "${trimmed}" sudah ada.`, 409);
  }

  const variationType = await prisma.variationType.create({
    data: { name: trimmed },
    include: { _count: { select: { values: true } } },
  });

  return apiResponse(
    variationType,
    201,
    `Tipe variasi "${trimmed}" berhasil dibuat.`
  );
});
