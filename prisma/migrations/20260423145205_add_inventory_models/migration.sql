/*
  Warnings:

  - You are about to drop the column `category` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `minStockAlert` on the `productvariant` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `productvariant` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(12,2)`.
  - You are about to drop the `attribute` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `attributeoption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventorymovement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `variantoptionvalue` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `categoryId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `attribute` DROP FOREIGN KEY `Attribute_productId_fkey`;

-- DropForeignKey
ALTER TABLE `attributeoption` DROP FOREIGN KEY `AttributeOption_attributeId_fkey`;

-- DropForeignKey
ALTER TABLE `inventorymovement` DROP FOREIGN KEY `InventoryMovement_userId_fkey`;

-- DropForeignKey
ALTER TABLE `inventorymovement` DROP FOREIGN KEY `InventoryMovement_variantId_fkey`;

-- DropForeignKey
ALTER TABLE `variantoptionvalue` DROP FOREIGN KEY `VariantOptionValue_attributeOptionId_fkey`;

-- DropForeignKey
ALTER TABLE `variantoptionvalue` DROP FOREIGN KEY `VariantOptionValue_variantId_fkey`;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `category`,
    ADD COLUMN `categoryId` VARCHAR(191) NOT NULL,
    ADD COLUMN `image` VARCHAR(191) NULL,
    MODIFY `description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `productvariant` DROP COLUMN `minStockAlert`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `minStock` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    MODIFY `price` DECIMAL(12, 2) NOT NULL;

-- DropTable
DROP TABLE `attribute`;

-- DropTable
DROP TABLE `attributeoption`;

-- DropTable
DROP TABLE `inventorymovement`;

-- DropTable
DROP TABLE `variantoptionvalue`;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VariationType` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VariationType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VariationValue` (
    `id` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `variationTypeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VariationValue_variationTypeId_idx`(`variationTypeId`),
    UNIQUE INDEX `VariationValue_variationTypeId_value_key`(`variationTypeId`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductVariationType` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variationTypeId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,

    INDEX `ProductVariationType_productId_idx`(`productId`),
    UNIQUE INDEX `ProductVariationType_productId_variationTypeId_key`(`productId`, `variationTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductVariantValue` (
    `id` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `variationValueId` VARCHAR(191) NOT NULL,

    INDEX `ProductVariantValue_variantId_idx`(`variantId`),
    UNIQUE INDEX `ProductVariantValue_variantId_variationValueId_key`(`variantId`, `variationValueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockIn` (
    `id` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockIn_variantId_idx`(`variantId`),
    INDEX `StockIn_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockOut` (
    `id` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockOut_variantId_idx`(`variantId`),
    INDEX `StockOut_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Product_categoryId_idx` ON `Product`(`categoryId`);

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VariationValue` ADD CONSTRAINT `VariationValue_variationTypeId_fkey` FOREIGN KEY (`variationTypeId`) REFERENCES `VariationType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariationType` ADD CONSTRAINT `ProductVariationType_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariationType` ADD CONSTRAINT `ProductVariationType_variationTypeId_fkey` FOREIGN KEY (`variationTypeId`) REFERENCES `VariationType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariantValue` ADD CONSTRAINT `ProductVariantValue_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariantValue` ADD CONSTRAINT `ProductVariantValue_variationValueId_fkey` FOREIGN KEY (`variationValueId`) REFERENCES `VariationValue`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIn` ADD CONSTRAINT `StockIn_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockOut` ADD CONSTRAINT `StockOut_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
