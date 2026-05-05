import { StockInClient } from "@/components/stock/StockInClient";
import { requirePageAdmin } from "@/lib/page-auth";

export default async function StockInPage() {
  await requirePageAdmin();

  return <StockInClient />;
}
