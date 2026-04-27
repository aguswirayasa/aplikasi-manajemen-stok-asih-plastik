import { NextRequest } from "next/server";
import {
  apiResponse,
  requireAdmin,
  withErrorHandler,
} from "@/lib/api-helpers";
import { recordStockIn } from "@/lib/stock-mutations";
import { parseOptionalStockNote, parseStockItems } from "@/lib/stock-validation";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAdmin();

  const body = await req.json();
  const note = parseOptionalStockNote(body.note);
  const items = parseStockItems(body, "barang masuk");
  const result = await recordStockIn(user.id, items, note);

  return apiResponse(result, 201, "Stok masuk berhasil dicatat.");
});
