import prisma from "@/lib/prisma";
import type { TelegramVariantSnapshot } from "@/lib/telegram/conversation-state";

const SEARCH_LIMIT = 5;

type VariantSearchRow = {
  id: string;
  sku: string;
  stock: number;
  minStock: number;
  isActive: boolean;
  product: {
    name: string;
  };
  values: Array<{
    variationValue: {
      value: string;
    };
  }>;
};

export type TelegramVariantSearchResult = {
  variant: TelegramVariantSnapshot;
  score: number;
  exactSku: boolean;
};

export async function searchTelegramVariants(query: string | null) {
  const tokens = tokenizeSearchQuery(query);

  if (tokens.length === 0) {
    return [];
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: { is: { isArchived: false } },
      OR: tokens.flatMap((token) => [
        { sku: { contains: token } },
        { product: { is: { name: { contains: token } } } },
        {
          values: {
            some: {
              variationValue: {
                value: { contains: token },
              },
            },
          },
        },
      ]),
    },
    include: {
      product: {
        select: { name: true },
      },
      values: {
        include: {
          variationValue: {
            select: { value: true },
          },
        },
      },
    },
    orderBy: [{ sku: "asc" }],
    take: 50,
  });

  return rankTelegramVariants(variants, query || "", tokens).slice(
    0,
    SEARCH_LIMIT
  );
}

export function rankTelegramVariantsForTest(
  variants: VariantSearchRow[],
  query: string
) {
  return rankTelegramVariants(variants, query, tokenizeSearchQuery(query));
}

function rankTelegramVariants(
  variants: VariantSearchRow[],
  query: string,
  tokens: string[]
): TelegramVariantSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);

  return variants
    .map((variant) => {
      const variation = formatTelegramVariation(variant.values);
      const sku = normalizeSearchText(variant.sku);
      const productName = normalizeSearchText(variant.product.name);
      const variationText = normalizeSearchText(variation);
      const combined = `${sku} ${productName} ${variationText}`;
      const exactSku = sku === normalizedQuery;
      const allTokensMatch = tokens.every((token) => combined.includes(token));
      const matchedTokens = tokens.filter((token) => combined.includes(token));

      let score = matchedTokens.length * 10;

      if (allTokensMatch) {
        score += 100;
      }

      if (exactSku) {
        score += 1000;
      } else if (sku.startsWith(normalizedQuery)) {
        score += 500;
      }

      for (const token of tokens) {
        if (sku.includes(token)) {
          score += 20;
        }

        if (productName.includes(token)) {
          score += 15;
        }

        if (variationText.includes(token)) {
          score += 18;
        }
      }

      return {
        variant: toTelegramVariantSnapshot(variant, variation),
        score,
        exactSku,
        allTokensMatch,
      };
    })
    .filter((result) => result.score > 0)
    .sort((first, second) => {
      if (second.exactSku !== first.exactSku) {
        return Number(second.exactSku) - Number(first.exactSku);
      }

      if (second.allTokensMatch !== first.allTokensMatch) {
        return Number(second.allTokensMatch) - Number(first.allTokensMatch);
      }

      if (second.score !== first.score) {
        return second.score - first.score;
      }

      return first.variant.sku.localeCompare(second.variant.sku);
    })
    .map((result) => ({
      variant: result.variant,
      score: result.score,
      exactSku: result.exactSku,
    }));
}

export function formatTelegramVariation(
  values: VariantSearchRow["values"]
) {
  return (
    values
      .map((item) => item.variationValue.value)
      .filter(Boolean)
      .join(" / ") || "-"
  );
}

function toTelegramVariantSnapshot(
  variant: VariantSearchRow,
  variation: string
): TelegramVariantSnapshot {
  return {
    id: variant.id,
    sku: variant.sku,
    productName: variant.product.name,
    variation,
    stock: variant.stock,
    minStock: variant.minStock,
    isActive: variant.isActive,
  };
}

function tokenizeSearchQuery(query: string | null) {
  return normalizeSearchText(query || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function normalizeSearchText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
