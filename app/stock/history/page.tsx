import { StockHistoryView } from "@/components/stock/StockHistoryView";
import { requirePageAuth } from "@/lib/page-auth";
import {
  getStockHistory,
  parseStockHistoryFilter,
} from "@/lib/stock-history";

export const dynamic = "force-dynamic";

export default async function StockHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAuth();

  const filter = parseStockHistoryFilter(await searchParams);
  const result = await getStockHistory(filter);

  return <StockHistoryView result={result} />;
}
