export type SaleReceiptItem = {
  id: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  variant: {
    sku: string;
    product: {
      name: string;
    };
    values: Array<{
      variationValue: {
        value: string;
      };
    }>;
  };
};

export type SaleReceiptData = {
  id: string;
  receiptNumber: string;
  totalAmount: number | string;
  paidAmount: number | string;
  changeAmount: number | string;
  createdAt: Date | string;
  cashier: {
    name: string | null;
    username: string;
  };
  items: SaleReceiptItem[];
};
