import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 3306,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...\n");

  const adminPassword = await bcrypt.hash("admin123", 10);
  const pegawaiPassword = await bcrypt.hash("pegawai123", 10);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { password: adminPassword, name: "Administrator", isActive: true },
    create: {
      username: "admin",
      name: "Administrator",
      password: adminPassword,
      role: "ADMIN",
      isActive: true,
    },
  });

  const pegawai = await prisma.user.upsert({
    where: { username: "pegawai" },
    update: { password: pegawaiPassword, name: "Siti Kasir", isActive: true },
    create: {
      username: "pegawai",
      name: "Siti Kasir",
      password: pegawaiPassword,
      role: "PEGAWAI",
      isActive: true,
    },
  });

  console.log("Users:", admin.username, pegawai.username);

  const catPlastik = await prisma.category.upsert({
    where: { name: "Plastik" },
    update: {},
    create: { name: "Plastik" },
  });

  const catKertas = await prisma.category.upsert({
    where: { name: "Kertas" },
    update: {},
    create: { name: "Kertas" },
  });

  const catKardus = await prisma.category.upsert({
    where: { name: "Kardus" },
    update: {},
    create: { name: "Kardus" },
  });

  console.log("Categories:", catPlastik.name, catKertas.name, catKardus.name);

  const typeUkuran = await prisma.variationType.upsert({
    where: { name: "Ukuran" },
    update: {},
    create: { name: "Ukuran" },
  });

  const typeWarna = await prisma.variationType.upsert({
    where: { name: "Warna" },
    update: {},
    create: { name: "Warna" },
  });

  const typeKetebalan = await prisma.variationType.upsert({
    where: { name: "Ketebalan" },
    update: {},
    create: { name: "Ketebalan" },
  });

  console.log("Variation Types:", typeUkuran.name, typeWarna.name, typeKetebalan.name);

  async function upsertValue(variationTypeId: string, value: string) {
    return prisma.variationValue.upsert({
      where: { variationTypeId_value: { variationTypeId, value } },
      update: {},
      create: { variationTypeId, value },
    });
  }

  const valBesar = await upsertValue(typeUkuran.id, "Besar");
  const valKecil = await upsertValue(typeUkuran.id, "Kecil");
  const valSedang = await upsertValue(typeUkuran.id, "Sedang");
  const valMerah = await upsertValue(typeWarna.id, "Merah");
  const valBiru = await upsertValue(typeWarna.id, "Biru");
  const valHitam = await upsertValue(typeWarna.id, "Hitam");
  const val05mm = await upsertValue(typeKetebalan.id, "0.5mm");
  const val10mm = await upsertValue(typeKetebalan.id, "1.0mm");

  console.log("Variation Values: Besar, Kecil, Sedang, Merah, Biru, Hitam, 0.5mm, 1.0mm");

  // Seed produk contoh bersifat destruktif agar data SKU demo selalu konsisten.
  await prisma.productVariantValue.deleteMany({});
  await prisma.stockIn.deleteMany({});
  await prisma.stockOut.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productVariationType.deleteMany({});
  await prisma.product.deleteMany({});

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

  const plastikVariants = [
    { sku: "PLT-BSR-MRH-05", price: 5000, stock: 150, minStock: 10, values: [valBesar.id, valMerah.id, val05mm.id] },
    { sku: "PLT-BSR-MRH-10", price: 7000, stock: 80, minStock: 10, values: [valBesar.id, valMerah.id, val10mm.id] },
    { sku: "PLT-BSR-BRU-05", price: 5000, stock: 200, minStock: 10, values: [valBesar.id, valBiru.id, val05mm.id] },
    { sku: "PLT-BSR-BRU-10", price: 7000, stock: 60, minStock: 10, values: [valBesar.id, valBiru.id, val10mm.id] },
    { sku: "PLT-KCL-MRH-05", price: 3500, stock: 120, minStock: 10, values: [valKecil.id, valMerah.id, val05mm.id] },
    { sku: "PLT-KCL-BRU-05", price: 3500, stock: 90, minStock: 10, values: [valKecil.id, valBiru.id, val05mm.id] },
    { sku: "PLT-KCL-HTM-05", price: 3500, stock: 5, minStock: 10, values: [valKecil.id, valHitam.id, val05mm.id] },
  ];

  for (const variantData of plastikVariants) {
    const variant = await prisma.productVariant.create({
      data: {
        productId: prodPlastik.id,
        sku: variantData.sku,
        price: variantData.price,
        stock: variantData.stock,
        minStock: variantData.minStock,
      },
    });

    await prisma.productVariantValue.createMany({
      data: variantData.values.map((valueId) => ({
        variantId: variant.id,
        variationValueId: valueId,
      })),
    });
  }

  console.log(`Product "Plastik HD" with ${plastikVariants.length} SKU variants`);

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

  const kertasVariants = [
    { sku: "KRT-A4", price: 45000, stock: 50, minStock: 5, values: [valBesar.id] },
    { sku: "KRT-A3", price: 85000, stock: 3, minStock: 5, values: [valSedang.id] },
  ];

  for (const variantData of kertasVariants) {
    const variant = await prisma.productVariant.create({
      data: {
        productId: prodKertas.id,
        sku: variantData.sku,
        price: variantData.price,
        stock: variantData.stock,
        minStock: variantData.minStock,
      },
    });

    await prisma.productVariantValue.createMany({
      data: variantData.values.map((valueId) => ({
        variantId: variant.id,
        variationValueId: valueId,
      })),
    });
  }

  console.log(`Product "Kertas HVS" with ${kertasVariants.length} SKU variants`);

  const totalVariants = await prisma.productVariant.count();

  console.log("\nSeed Summary:");
  console.log("   Users: 2 (admin + pegawai)");
  console.log("   Categories: 3");
  console.log("   Variation Types: 3");
  console.log("   Variation Values: 8");
  console.log("   Products: 2");
  console.log(`   Total SKU Variants: ${totalVariants}`);
  console.log("\nSeed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
