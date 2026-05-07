-- DropForeignKey
ALTER TABLE `Attribute` DROP FOREIGN KEY `Attribute_productId_fkey`;

-- DropForeignKey
ALTER TABLE `AttributeOption` DROP FOREIGN KEY `AttributeOption_attributeId_fkey`;

-- DropForeignKey
ALTER TABLE `InventoryMovement` DROP FOREIGN KEY `InventoryMovement_userId_fkey`;

-- DropForeignKey
ALTER TABLE `InventoryMovement` DROP FOREIGN KEY `InventoryMovement_variantId_fkey`;

-- DropForeignKey
ALTER TABLE `VariantOptionValue` DROP FOREIGN KEY `VariantOptionValue_attributeOptionId_fkey`;

-- DropForeignKey
ALTER TABLE `VariantOptionValue` DROP FOREIGN KEY `VariantOptionValue_variantId_fkey`;

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

-- Kategori lama disalin sebelum kolom `Product.category` dihapus.
INSERT INTO `Category` (`id`, `name`, `createdAt`, `updatedAt`)
SELECT UUID(), `source`.`categoryName`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
    SELECT DISTINCT COALESCE(NULLIF(TRIM(`category`), ''), 'Tanpa Kategori') AS `categoryName`
    FROM `Product`
) AS `source`
WHERE NOT EXISTS (
    SELECT 1
    FROM `Category` AS `existing`
    WHERE `existing`.`name` = `source`.`categoryName`
);

-- AlterTable
ALTER TABLE `Product`
    ADD COLUMN `categoryId` VARCHAR(191) NULL,
    ADD COLUMN `image` VARCHAR(191) NULL,
    MODIFY `description` VARCHAR(191) NULL;

UPDATE `Product` AS `product`
INNER JOIN `Category` AS `category`
    ON `category`.`name` = COALESCE(NULLIF(TRIM(`product`.`category`), ''), 'Tanpa Kategori')
SET `product`.`categoryId` = `category`.`id`
WHERE `product`.`categoryId` IS NULL;

ALTER TABLE `Product`
    MODIFY `categoryId` VARCHAR(191) NOT NULL,
    DROP COLUMN `category`;

-- AlterTable
ALTER TABLE `ProductVariant`
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `minStock` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updatedAt` DATETIME(3) NULL,
    MODIFY `price` DECIMAL(12, 2) NOT NULL;

UPDATE `ProductVariant`
SET `minStock` = `minStockAlert`;

UPDATE `ProductVariant`
SET `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `updatedAt` IS NULL;

ALTER TABLE `ProductVariant`
    MODIFY `updatedAt` DATETIME(3) NOT NULL,
    DROP COLUMN `minStockAlert`;

-- Data atribut lama dipindahkan ke struktur variasi baru.
INSERT INTO `VariationType` (`id`, `name`, `createdAt`, `updatedAt`)
SELECT UUID(), `source`.`name`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
    SELECT DISTINCT `name`
    FROM `Attribute`
) AS `source`
WHERE NOT EXISTS (
    SELECT 1
    FROM `VariationType` AS `existing`
    WHERE `existing`.`name` = `source`.`name`
);

INSERT INTO `VariationValue` (`id`, `value`, `variationTypeId`, `createdAt`, `updatedAt`)
SELECT UUID(), `source`.`value`, `source`.`variationTypeId`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
    SELECT DISTINCT `option`.`value`, `type`.`id` AS `variationTypeId`
    FROM `AttributeOption` AS `option`
    INNER JOIN `Attribute` AS `attribute` ON `attribute`.`id` = `option`.`attributeId`
    INNER JOIN `VariationType` AS `type` ON `type`.`name` = `attribute`.`name`
) AS `source`
WHERE NOT EXISTS (
    SELECT 1
    FROM `VariationValue` AS `existing`
    WHERE `existing`.`variationTypeId` = `source`.`variationTypeId`
        AND `existing`.`value` = `source`.`value`
);

INSERT INTO `ProductVariationType` (`id`, `productId`, `variationTypeId`, `sortOrder`)
SELECT UUID(), `source`.`productId`, `source`.`variationTypeId`, `source`.`sortOrder`
FROM (
    SELECT
        `attribute`.`productId`,
        `type`.`id` AS `variationTypeId`,
        ROW_NUMBER() OVER (
            PARTITION BY `attribute`.`productId`
            ORDER BY `attribute`.`name`, `attribute`.`id`
        ) AS `sortOrder`
    FROM `Attribute` AS `attribute`
    INNER JOIN `VariationType` AS `type` ON `type`.`name` = `attribute`.`name`
) AS `source`
WHERE NOT EXISTS (
    SELECT 1
    FROM `ProductVariationType` AS `existing`
    WHERE `existing`.`productId` = `source`.`productId`
        AND `existing`.`variationTypeId` = `source`.`variationTypeId`
);

INSERT IGNORE INTO `ProductVariantValue` (`id`, `variantId`, `variationValueId`)
SELECT UUID(), `variantValue`.`variantId`, `value`.`id`
FROM `VariantOptionValue` AS `variantValue`
INNER JOIN `AttributeOption` AS `option` ON `option`.`id` = `variantValue`.`attributeOptionId`
INNER JOIN `Attribute` AS `attribute` ON `attribute`.`id` = `option`.`attributeId`
INNER JOIN `VariationType` AS `type` ON `type`.`name` = `attribute`.`name`
INNER JOIN `VariationValue` AS `value`
    ON `value`.`variationTypeId` = `type`.`id`
    AND `value`.`value` = `option`.`value`;

-- Riwayat stok lama dipisah sesuai model audit baru.
INSERT INTO `StockIn` (`id`, `variantId`, `quantity`, `note`, `userId`, `createdAt`)
SELECT UUID(), `variantId`, `quantity`, `note`, `userId`, `createdAt`
FROM `InventoryMovement`
WHERE `type` = 'IN';

INSERT INTO `StockOut` (`id`, `variantId`, `quantity`, `note`, `userId`, `createdAt`)
SELECT UUID(), `variantId`, `quantity`, `note`, `userId`, `createdAt`
FROM `InventoryMovement`
WHERE `type` = 'OUT';

-- DropTable
DROP TABLE `Attribute`;

-- DropTable
DROP TABLE `AttributeOption`;

-- DropTable
DROP TABLE `InventoryMovement`;

-- DropTable
DROP TABLE `VariantOptionValue`;

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
