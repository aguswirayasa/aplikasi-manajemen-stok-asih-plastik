import "dotenv/config";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

function getDatabasePort() {
  return process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 3306;
}

function buildDatabaseUrlFromAdapterEnv() {
  const {
    DATABASE_HOST: host,
    DATABASE_USER: user,
    DATABASE_PASSWORD: password,
    DATABASE_NAME: database,
  } = process.env;

  if (!host || !user || !database) {
    return process.env.DATABASE_URL;
  }

  const credentials = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);

  return `mysql://${credentials}@${host}:${getDatabasePort()}/${database}`;
}

function runMigrations() {
  console.log("Ensuring database schema exists...");

  const require = createRequire(__filename);
  const prismaCli = require.resolve("prisma/build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: buildDatabaseUrlFromAdapterEnv(),
    },
  });
}

function createPrismaClient() {
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST,
    port: getDatabasePort(),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  });

  return new PrismaClient({ adapter });
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function setTime(date: Date, hours: number, minutes: number) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

type SeedVariant = {
  sku: string;
  price: number;
  stock: number;
  minStock: number;
  isActive?: boolean;
  values: string[];
};

type CreatedVariant = Awaited<
  ReturnType<PrismaClient["productVariant"]["create"]>
>;

let prisma: PrismaClient | null = null;

type CountRow = {
  count: bigint | number | string;
};

function readCount(rows: CountRow[]) {
  const [row] = rows;
  if (!row) {
    return 0;
  }

  return Number(row.count);
}

async function hasTable(client: PrismaClient, tableName: string) {
  const rows = await client.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    tableName
  );

  return readCount(rows) > 0;
}

async function hasColumn(
  client: PrismaClient,
  tableName: string,
  columnName: string
) {
  const rows = await client.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    tableName,
    columnName
  );

  return readCount(rows) > 0;
}

async function hasIndex(
  client: PrismaClient,
  tableName: string,
  indexName: string
) {
  const rows = await client.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    tableName,
    indexName
  );

  return readCount(rows) > 0;
}

async function ensureUserTelegramColumns(client: PrismaClient) {
  if (!(await hasColumn(client, "User", "telegramChatId"))) {
    await client.$executeRawUnsafe(
      "ALTER TABLE `User` ADD COLUMN `telegramChatId` VARCHAR(191) NULL"
    );
  }

  if (!(await hasColumn(client, "User", "telegramUsername"))) {
    await client.$executeRawUnsafe(
      "ALTER TABLE `User` ADD COLUMN `telegramUsername` VARCHAR(191) NULL"
    );
  }

  if (!(await hasColumn(client, "User", "telegramLinkedAt"))) {
    await client.$executeRawUnsafe(
      "ALTER TABLE `User` ADD COLUMN `telegramLinkedAt` DATETIME(3) NULL"
    );
  }

  if (!(await hasIndex(client, "User", "User_telegramChatId_key"))) {
    await client.$executeRawUnsafe(
      "CREATE UNIQUE INDEX `User_telegramChatId_key` ON `User`(`telegramChatId`)"
    );
  }
}

async function ensureTelegramLinkTokenTable(client: PrismaClient) {
  if (await hasTable(client, "TelegramLinkToken")) {
    return;
  }

  await client.$executeRawUnsafe(`
    CREATE TABLE \`TelegramLinkToken\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`tokenHash\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`expiresAt\` DATETIME(3) NOT NULL,
      \`usedAt\` DATETIME(3) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

      UNIQUE INDEX \`TelegramLinkToken_tokenHash_key\`(\`tokenHash\`),
      INDEX \`TelegramLinkToken_userId_idx\`(\`userId\`),
      INDEX \`TelegramLinkToken_expiresAt_idx\`(\`expiresAt\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await client.$executeRawUnsafe(
    "ALTER TABLE `TelegramLinkToken` ADD CONSTRAINT `TelegramLinkToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE"
  );
}

async function ensureTelegramConversationStateTable(client: PrismaClient) {
  if (await hasTable(client, "TelegramConversationState")) {
    return;
  }

  await client.$executeRawUnsafe(`
    CREATE TABLE \`TelegramConversationState\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`chatId\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NULL,
      \`kind\` VARCHAR(191) NOT NULL,
      \`payload\` JSON NOT NULL,
      \`expiresAt\` DATETIME(3) NOT NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL,

      UNIQUE INDEX \`TelegramConversationState_chatId_key\`(\`chatId\`),
      INDEX \`TelegramConversationState_userId_idx\`(\`userId\`),
      INDEX \`TelegramConversationState_expiresAt_idx\`(\`expiresAt\`),
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await client.$executeRawUnsafe(
    "ALTER TABLE `TelegramConversationState` ADD CONSTRAINT `TelegramConversationState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE"
  );
}

async function ensureSeedSchema(client: PrismaClient) {
  console.log("Verifying seed database objects...");

  // Perbaikan defensif untuk database yang riwayat migrasinya sudah applied,
  // tetapi objek fisik Telegram belum ada di MariaDB.
  await ensureUserTelegramColumns(client);
  await ensureTelegramLinkTokenTable(client);
  await ensureTelegramConversationStateTable(client);
}

async function resetData(client: PrismaClient) {
  // Urutan hapus mengikuti dependency foreign key agar seed bisa diulang stabil.
  await client.telegramConversationState.deleteMany({});
  await client.telegramLinkToken.deleteMany({});
  await client.stockOut.deleteMany({});
  await client.stockIn.deleteMany({});
  await client.saleItem.deleteMany({});
  await client.sale.deleteMany({});
  await client.productVariantValue.deleteMany({});
  await client.productVariant.deleteMany({});
  await client.productVariationType.deleteMany({});
  await client.product.deleteMany({});
  await client.variationValue.deleteMany({});
  await client.variationType.deleteMany({});
  await client.category.deleteMany({});
  await client.user.deleteMany({});
}

async function createVariant(
  client: PrismaClient,
  productId: string,
  valueIdsByName: Map<string, string>,
  variantData: SeedVariant
) {
  const variant = await client.productVariant.create({
    data: {
      productId,
      sku: variantData.sku,
      price: variantData.price,
      stock: variantData.stock,
      minStock: variantData.minStock,
      isActive: variantData.isActive ?? true,
    },
  });

  if (variantData.values.length > 0) {
    await client.productVariantValue.createMany({
      data: variantData.values.map((value) => {
        const variationValueId = valueIdsByName.get(value);
        if (!variationValueId) {
          throw new Error(`Seed variation value ${value} tidak ditemukan.`);
        }

        return {
          variantId: variant.id,
          variationValueId,
        };
      }),
    });
  }

  return variant;
}

async function createSale(
  client: PrismaClient,
  cashierId: string,
  receiptNumber: string,
  items: Array<{ variant: CreatedVariant; quantity: number; unitPrice: number }>,
  paidAmount: number,
  createdAt: Date
) {
  const totalAmount = items.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0
  );

  const sale = await client.sale.create({
    data: {
      receiptNumber,
      totalAmount,
      paidAmount,
      changeAmount: paidAmount - totalAmount,
      cashierId,
      createdAt,
    },
  });

  for (const item of items) {
    const saleItem = await client.saleItem.create({
      data: {
        saleId: sale.id,
        variantId: item.variant.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice,
        createdAt,
      },
    });

    await client.stockOut.create({
      data: {
        variantId: item.variant.id,
        quantity: item.quantity,
        note: `Penjualan ${receiptNumber}`,
        userId: cashierId,
        saleItemId: saleItem.id,
        createdAt,
      },
    });
  }

  return sale;
}

async function main() {
  runMigrations();
  prisma = createPrismaClient();
  await ensureSeedSchema(prisma);

  console.log("\nSeeding black-box fixture data...\n");

  await resetData(prisma);

  const now = new Date();
  const todayMorning = setTime(now, 9, 15);
  const todayAfternoon = setTime(now, 14, 30);
  const yesterday = setTime(addDays(now, -1), 15, 0);
  const oldDate = new Date("2026-01-15T08:00:00.000+08:00");

  const adminPassword = await bcrypt.hash("admin123", 10);
  const pegawaiPassword = await bcrypt.hash("pegawai123", 10);

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      name: "Administrator",
      password: adminPassword,
      role: "ADMIN",
      isActive: true,
    },
  });

  const pegawai = await prisma.user.create({
    data: {
      username: "pegawai",
      name: "Siti Kasir",
      password: pegawaiPassword,
      role: "PEGAWAI",
      isActive: true,
    },
  });

  const extraAdmin = await prisma.user.create({
    data: {
      username: "admin-bb-seed",
      name: "Admin BB Seed",
      password: adminPassword,
      role: "ADMIN",
      isActive: true,
      telegramChatId: "900100200",
      telegramUsername: "admin_bb_seed",
      telegramLinkedAt: yesterday,
    },
  });

  const extraPegawai = await prisma.user.create({
    data: {
      username: "pegawai-bb-seed",
      name: "Pegawai BB Seed",
      password: pegawaiPassword,
      role: "PEGAWAI",
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      username: "pegawai-nonaktif-bb",
      name: "Pegawai Nonaktif BB",
      password: pegawaiPassword,
      role: "PEGAWAI",
      isActive: false,
    },
  });

  console.log("Users: admin, pegawai, admin-bb-seed, pegawai-bb-seed, pegawai-nonaktif-bb");

  const [catPlastik, catKertas, catKardus, catUjiKosong] = await Promise.all([
    prisma.category.create({ data: { name: "Plastik" } }),
    prisma.category.create({ data: { name: "Kertas" } }),
    prisma.category.create({ data: { name: "Kardus" } }),
    prisma.category.create({ data: { name: "Kategori Kosong BB" } }),
  ]);

  console.log("Categories: Plastik, Kertas, Kardus, Kategori Kosong BB");

  const [typeUkuran, typeWarna, typeKetebalan, typeMaterial] = await Promise.all([
    prisma.variationType.create({ data: { name: "Ukuran" } }),
    prisma.variationType.create({ data: { name: "Warna" } }),
    prisma.variationType.create({ data: { name: "Ketebalan" } }),
    prisma.variationType.create({ data: { name: "Material BB" } }),
  ]);

  const values = await Promise.all([
    prisma.variationValue.create({
      data: { variationTypeId: typeUkuran.id, value: "Besar" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeUkuran.id, value: "Kecil" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeUkuran.id, value: "Sedang" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeWarna.id, value: "Merah" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeWarna.id, value: "Biru" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeWarna.id, value: "Hitam" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeWarna.id, value: "Hijau BB Seed" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeKetebalan.id, value: "0.5mm" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeKetebalan.id, value: "1.0mm" },
    }),
    prisma.variationValue.create({
      data: { variationTypeId: typeMaterial.id, value: "Daur Ulang BB" },
    }),
  ]);

  const valueIdsByName = new Map(values.map((value) => [value.value, value.id]));

  console.log(
    "Variation Types: Ukuran, Warna, Ketebalan, Material BB"
  );
  console.log(
    "Variation Values: Besar, Kecil, Sedang, Merah, Biru, Hitam, Hijau BB Seed, 0.5mm, 1.0mm, Daur Ulang BB"
  );

  const prodPlastik = await prisma.product.create({
    data: {
      name: "Plastik HD",
      description: "Plastik HD kualitas premium, tahan sobek",
      categoryId: catPlastik.id,
    },
  });

  await prisma.productVariationType.createMany({
    data: [
      { productId: prodPlastik.id, variationTypeId: typeUkuran.id, sortOrder: 1 },
      { productId: prodPlastik.id, variationTypeId: typeWarna.id, sortOrder: 2 },
      { productId: prodPlastik.id, variationTypeId: typeKetebalan.id, sortOrder: 3 },
    ],
  });

  const plastikVariantInput: SeedVariant[] = [
    {
      sku: "PLT-BSR-MRH-05",
      price: 5000,
      stock: 153,
      minStock: 10,
      values: ["Besar", "Merah", "0.5mm"],
    },
    {
      sku: "PLT-BSR-MRH-10",
      price: 7000,
      stock: 78,
      minStock: 10,
      values: ["Besar", "Merah", "1.0mm"],
    },
    {
      sku: "PLT-BSR-BRU-05",
      price: 5000,
      stock: 199,
      minStock: 10,
      values: ["Besar", "Biru", "0.5mm"],
    },
    {
      sku: "PLT-BSR-BRU-10",
      price: 7000,
      stock: 60,
      minStock: 10,
      values: ["Besar", "Biru", "1.0mm"],
    },
    {
      sku: "PLT-KCL-MRH-05",
      price: 3500,
      stock: 120,
      minStock: 10,
      values: ["Kecil", "Merah", "0.5mm"],
    },
    {
      sku: "PLT-KCL-BRU-05",
      price: 3500,
      stock: 90,
      minStock: 10,
      values: ["Kecil", "Biru", "0.5mm"],
    },
    {
      sku: "PLT-KCL-HTM-05",
      price: 3500,
      stock: 5,
      minStock: 10,
      values: ["Kecil", "Hitam", "0.5mm"],
    },
    {
      sku: "PLT-NONAKTIF-BB",
      price: 2500,
      stock: 12,
      minStock: 2,
      isActive: false,
      values: ["Kecil", "Hijau BB Seed", "0.5mm"],
    },
  ];

  const plastikVariants = new Map<string, CreatedVariant>();
  for (const variantData of plastikVariantInput) {
    const variant = await createVariant(
      prisma,
      prodPlastik.id,
      valueIdsByName,
      variantData
    );
    plastikVariants.set(variant.sku, variant);
  }

  const prodKertas = await prisma.product.create({
    data: {
      name: "Kertas HVS",
      description: "Kertas HVS untuk fotokopi dan print",
      categoryId: catKertas.id,
    },
  });

  await prisma.productVariationType.create({
    data: { productId: prodKertas.id, variationTypeId: typeUkuran.id, sortOrder: 1 },
  });

  const kertasVariantInput: SeedVariant[] = [
    {
      sku: "KRT-A4",
      price: 45000,
      stock: 51,
      minStock: 5,
      values: ["Besar"],
    },
    {
      sku: "KRT-A3",
      price: 85000,
      stock: 3,
      minStock: 5,
      values: ["Sedang"],
    },
  ];

  const kertasVariants = new Map<string, CreatedVariant>();
  for (const variantData of kertasVariantInput) {
    const variant = await createVariant(
      prisma,
      prodKertas.id,
      valueIdsByName,
      variantData
    );
    kertasVariants.set(variant.sku, variant);
  }

  const prodKardus = await prisma.product.create({
    data: {
      name: "Kardus Packing BB",
      description: "Produk fixture untuk pengujian produk tanpa variasi",
      categoryId: catKardus.id,
    },
  });

  const kardusVariant = await createVariant(prisma, prodKardus.id, valueIdsByName, {
    sku: "KDS-PACK-BB",
    price: 12000,
    stock: 24,
    minStock: 5,
    values: [],
  });

  const archivedProduct = await prisma.product.create({
    data: {
      name: "Produk Arsip BB",
      description: "Produk arsip untuk validasi data nonaktif",
      categoryId: catUjiKosong.id,
      isArchived: true,
      archivedAt: oldDate,
    },
  });

  await createVariant(prisma, archivedProduct.id, valueIdsByName, {
    sku: "ARSIP-BB-001",
    price: 1000,
    stock: 0,
    minStock: 0,
    isActive: false,
    values: [],
  });

  const requiredPlastikVariant = (sku: string) => {
    const variant = plastikVariants.get(sku);
    if (!variant) {
      throw new Error(`Seed variant ${sku} tidak ditemukan.`);
    }
    return variant;
  };

  const requiredKertasVariant = (sku: string) => {
    const variant = kertasVariants.get(sku);
    if (!variant) {
      throw new Error(`Seed variant ${sku} tidak ditemukan.`);
    }
    return variant;
  };

  const krtA4 = requiredKertasVariant("KRT-A4");
  const krtA3 = requiredKertasVariant("KRT-A3");
  const pltMerah05 = requiredPlastikVariant("PLT-BSR-MRH-05");
  const pltMerah10 = requiredPlastikVariant("PLT-BSR-MRH-10");
  const pltBiru05 = requiredPlastikVariant("PLT-BSR-BRU-05");
  const pltHitam05 = requiredPlastikVariant("PLT-KCL-HTM-05");

  await prisma.stockIn.createMany({
    data: [
      {
        variantId: krtA4.id,
        quantity: 2,
        note: "Kiriman supplier BB",
        batchId: "bb-stockin-today",
        userId: pegawai.id,
        createdAt: todayMorning,
      },
      {
        variantId: pltMerah05.id,
        quantity: 5,
        note: "Kiriman supplier BB",
        batchId: "bb-stockin-today",
        userId: pegawai.id,
        createdAt: todayMorning,
      },
      {
        variantId: krtA3.id,
        quantity: 3,
        note: "Restock stok rendah BB",
        batchId: "bb-stockin-yesterday",
        userId: admin.id,
        createdAt: yesterday,
      },
      {
        variantId: pltHitam05.id,
        quantity: 5,
        note: "Restock SKU kritis BB",
        batchId: "bb-stockin-yesterday",
        userId: admin.id,
        createdAt: yesterday,
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        variantId: index % 2 === 0 ? pltBiru05.id : kardusVariant.id,
        quantity: index + 1,
        note: `Riwayat pagination BB ${index + 1}`,
        batchId: `bb-page-${index + 1}`,
        userId: index % 2 === 0 ? admin.id : pegawai.id,
        createdAt: new Date(oldDate.getTime() + index * 60_000),
      })),
    ],
  });

  await prisma.stockOut.createMany({
    data: [
      {
        variantId: pltMerah10.id,
        quantity: 2,
        note: "Barang rusak BB",
        batchId: "bb-manual-out",
        userId: admin.id,
        createdAt: yesterday,
      },
      {
        variantId: pltBiru05.id,
        quantity: 1,
        note: "Sampel display BB",
        batchId: "bb-manual-out",
        userId: pegawai.id,
        createdAt: todayMorning,
      },
    ],
  });

  await createSale(
    prisma,
    pegawai.id,
    "SALE-BB-0001",
    [{ variant: krtA4, quantity: 1, unitPrice: 45000 }],
    50000,
    todayAfternoon
  );

  await createSale(
    prisma,
    pegawai.id,
    "SALE-BB-0002",
    [
      { variant: pltMerah05, quantity: 2, unitPrice: 5000 },
      { variant: pltBiru05, quantity: 1, unitPrice: 5000 },
    ],
    20000,
    setTime(now, 16, 45)
  );

  await prisma.telegramLinkToken.createMany({
    data: [
      {
        tokenHash: tokenHash("ASIH-BB-ACTIVE"),
        userId: admin.id,
        expiresAt: addDays(now, 1),
        createdAt: now,
      },
      {
        tokenHash: tokenHash("ASIH-BB-USED"),
        userId: extraAdmin.id,
        expiresAt: addDays(now, 1),
        usedAt: yesterday,
        createdAt: yesterday,
      },
      {
        tokenHash: tokenHash("ASIH-BB-EXPIRED"),
        userId: extraPegawai.id,
        expiresAt: addDays(now, -1),
        createdAt: addDays(now, -2),
      },
    ],
  });

  await prisma.telegramConversationState.createMany({
    data: [
      {
        chatId: "900100200",
        userId: extraAdmin.id,
        kind: "awaitNote",
        payload: {
          action: "stockIn",
          sku: "KRT-A4",
          quantity: 1,
        },
        expiresAt: addDays(now, 1),
        createdAt: now,
        updatedAt: now,
      },
      {
        chatId: "900100201",
        userId: extraPegawai.id,
        kind: "awaitQuantity",
        payload: {
          action: "stockOut",
          sku: "PLT-BSR-MRH-05",
        },
        expiresAt: addDays(now, 1),
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  const [
    totalUsers,
    totalCategories,
    totalVariationTypes,
    totalVariationValues,
    totalProducts,
    totalVariants,
    totalStockIns,
    totalStockOuts,
    totalSales,
    totalSaleItems,
    totalTelegramTokens,
    totalTelegramStates,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.variationType.count(),
    prisma.variationValue.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.stockIn.count(),
    prisma.stockOut.count(),
    prisma.sale.count(),
    prisma.saleItem.count(),
    prisma.telegramLinkToken.count(),
    prisma.telegramConversationState.count(),
  ]);

  console.log("\nSeed Summary:");
  console.log(`   Users: ${totalUsers}`);
  console.log(`   Categories: ${totalCategories}`);
  console.log(`   Variation Types: ${totalVariationTypes}`);
  console.log(`   Variation Values: ${totalVariationValues}`);
  console.log(`   Products: ${totalProducts}`);
  console.log(`   Total SKU Variants: ${totalVariants}`);
  console.log(`   Stock In Rows: ${totalStockIns}`);
  console.log(`   Stock Out Rows: ${totalStockOuts}`);
  console.log(`   Sales: ${totalSales}`);
  console.log(`   Sale Items: ${totalSaleItems}`);
  console.log(`   Telegram Link Tokens: ${totalTelegramTokens}`);
  console.log(`   Telegram Conversation States: ${totalTelegramStates}`);
  console.log("\nSeed complete.");
}

main()
  .then(async () => {
    await prisma?.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma?.$disconnect();
    process.exit(1);
  });
