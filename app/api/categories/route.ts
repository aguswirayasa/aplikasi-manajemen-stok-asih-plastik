import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  ApiError,
  apiResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";

export const GET = withErrorHandler(async (_req: NextRequest) => {
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
  await requireAuth();

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError("Nama kategori wajib diisi.", 400);
  }

  const category = await prisma.category.create({
    data: { name: name.trim() },
  });

  return apiResponse(category, 201);
});
