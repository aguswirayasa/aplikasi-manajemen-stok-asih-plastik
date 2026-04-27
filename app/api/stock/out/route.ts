import { NextRequest } from "next/server";
import {
  apiResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-helpers";
import { recordStockOut } from "@/lib/stock-mutations";
import { parseOptionalStockNote, parseStockItems } from "@/lib/stock-validation";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuth();

  const body = await req.json();
  const note = parseOptionalStockNote(body.note);
  const items = parseStockItems(body, "barang keluar");
  const result = await recordStockOut(user.id, items, note);

  return apiResponse(result, 201, "Stok keluar berhasil dicatat.");
});
