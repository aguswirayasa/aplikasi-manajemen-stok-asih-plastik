import { SaleDetailClient } from "@/components/sales/SaleDetailClient";
import { requirePageAuth } from "@/lib/page-auth";
import { getSaleDetailById } from "@/lib/sales";
import type { SaleReceiptData } from "@/types/sales";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAuth();
  const { id } = await params;
  const sale = await getSaleDetailById(id);

  return <SaleDetailClient sale={toReceiptData(sale)} />;
}

function toReceiptData(sale: Awaited<ReturnType<typeof getSaleDetailById>>) {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    totalAmount: sale.totalAmount.toString(),
    paidAmount: sale.paidAmount.toString(),
    changeAmount: sale.changeAmount.toString(),
    createdAt: sale.createdAt.toISOString(),
    cashier: sale.cashier,
    items: sale.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
      variant: {
        sku: item.variant.sku,
        product: {
          name: item.variant.product.name,
        },
        values: item.variant.values.map((value) => ({
          variationValue: {
            value: value.variationValue.value,
          },
        })),
      },
    })),
  } satisfies SaleReceiptData;
}
