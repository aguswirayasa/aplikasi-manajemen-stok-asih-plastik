import { StockInClient } from "@/components/stock/StockInClient";
import { requirePageAuth } from "@/lib/page-auth";

export default async function StockInPage() {
  await requirePageAuth();

  return <StockInClient />;
}
