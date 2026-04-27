import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  PackageOpen,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  mergeStockTransactions,
  stockTransactionInclude,
} from "@/lib/stock-transactions";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

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

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <History className="mt-1 h-7 w-7 text-[#ff4f00]" />
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
              Audit stok
            </p>
            <h1 className="text-[28px] font-semibold leading-[1] text-[#201515]">
              Riwayat Transaksi
            </h1>
            <p className="mt-1 max-w-[620px] text-[15px] leading-[1.25] text-[#939084]">
              Seratus transaksi terbaru dari barang masuk dan kasir stok keluar.
            </p>
          </div>
        </div>
        <div className="rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] px-3 py-2 text-[13px] font-semibold text-[#36342e]">
          {history.length} transaksi
        </div>
      </header>

      <section className="overflow-hidden rounded-[8px] border border-[#c5c0b1] bg-[#fffefb]">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#c5c0b1] bg-[#eceae3]/50">
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Tipe
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Waktu
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  SKU
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Produk
                </th>
                <th className="p-4 text-right text-[13px] font-bold text-[#201515]">
                  Qty
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  User
                </th>
                <th className="p-4 text-[13px] font-bold text-[#201515]">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10">
                    <EmptyHistory />
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr
                    key={`${item.type}-${item.id}`}
                    className="border-b border-[#eceae3] last:border-0 hover:bg-[#eceae3]/25"
                  >
                    <td className="p-4">
                      <TransactionType type={item.type} />
                    </td>
                    <td className="p-4 text-[14px] text-[#36342e]">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-[#201515]">
                        {item.variant.sku}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-[14px] font-semibold text-[#201515]">
                        {item.variant.product.name}
                      </p>
                      <p className="text-[12px] text-[#939084]">
                        {item.variant.values
                          .map((value) => value.variationValue.value)
                          .join(" / ") || "-"}
                      </p>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-[#201515]">
                        {item.type === "IN" ? "+" : "-"}
                        {item.quantity}
                      </span>
                    </td>
                    <td className="p-4 text-[14px] text-[#36342e]">
                      {item.user.name || item.user.username}
                    </td>
                    <td className="max-w-[260px] p-4 text-[14px] text-[#939084]">
                      <span className="line-clamp-2">{item.note || "-"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-[#eceae3] md:hidden">
          {history.length === 0 ? (
            <div className="p-8">
              <EmptyHistory />
            </div>
          ) : (
            history.map((item) => (
              <article key={`${item.type}-${item.id}`} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <TransactionIcon type={item.type} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[#201515]">
                          {item.variant.sku}
                        </p>
                        <TransactionType type={item.type} />
                      </div>
                      <p className="mt-1 text-[13px] font-semibold text-[#36342e]">
                        {item.variant.product.name}
                      </p>
                      <p className="text-[12px] text-[#939084]">
                        {item.variant.values
                          .map((value) => value.variationValue.value)
                          .join(" / ") || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[20px] font-bold leading-none text-[#201515]">
                      {item.type === "IN" ? "+" : "-"}
                      {item.quantity}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
                      Qty
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div className="rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/30 p-3">
                    <p className="font-semibold uppercase tracking-[0.5px] text-[#939084]">
                      Waktu
                    </p>
                    <p className="mt-1 text-[#36342e]">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="rounded-[5px] border border-[#c5c0b1] bg-[#eceae3]/30 p-3">
                    <p className="font-semibold uppercase tracking-[0.5px] text-[#939084]">
                      User
                    </p>
                    <p className="mt-1 text-[#36342e]">
                      {item.user.name || item.user.username}
                    </p>
                  </div>
                </div>

                {item.note && (
                  <p className="mt-3 rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] p-3 text-[13px] text-[#36342e]">
                    {item.note}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TransactionType({ type }: { type: "IN" | "OUT" }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-[20px] border border-[#c5c0b1] bg-[#fffefb] px-2.5 text-[12px] font-bold text-[#201515]">
      {type === "IN" ? (
        <ArrowDownLeft className="h-3.5 w-3.5 text-[#ff4f00]" />
      ) : (
        <ArrowUpRight className="h-3.5 w-3.5 text-[#ff4f00]" />
      )}
      {type === "IN" ? "Masuk" : "Keluar"}
    </span>
  );
}

function TransactionIcon({ type }: { type: "IN" | "OUT" }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-[#c5c0b1] bg-[#fffefb] text-[#ff4f00]">
      {type === "IN" ? (
        <ArrowDownLeft className="h-4 w-4" />
      ) : (
        <ArrowUpRight className="h-4 w-4" />
      )}
    </span>
  );
}

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <PackageOpen className="mb-3 h-9 w-9 text-[#c5c0b1]" />
      <h2 className="text-[16px] font-bold text-[#201515]">
        Belum ada transaksi
      </h2>
      <p className="mt-1 max-w-[320px] text-[14px] text-[#939084]">
        Riwayat akan muncul setelah stok masuk atau stok keluar dicatat.
      </p>
    </div>
  );
}
