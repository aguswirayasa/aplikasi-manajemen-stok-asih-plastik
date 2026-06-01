import { NextRequest } from "next/server";
import { apiResponse, requireAuth, withErrorHandler } from "@/lib/api-helpers";
import { getSaleDetailById } from "@/lib/sales";

export const GET = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireAuth();
  const { id } = await params;
  const sale = await getSaleDetailById(id);

  return apiResponse(sale);
});
