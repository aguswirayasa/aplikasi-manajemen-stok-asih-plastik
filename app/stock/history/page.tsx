import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { StockHistoryView } from "@/components/stock/StockHistoryView";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  mergeStockTransactions,
  stockTransactionInclude,
} from "@/lib/stock-transactions";

export const dynamic = "force-dynamic";

export default async function StockHistoryPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [stockIns, stockOuts] = await Promise.all([
    prisma.stockIn.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: stockTransactionInclude,
    }),
    prisma.stockOut.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: stockTransactionInclude,
    }),
  ]);

  const history = mergeStockTransactions(stockIns, stockOuts, 100);

  return <StockHistoryView history={history} />;
}
