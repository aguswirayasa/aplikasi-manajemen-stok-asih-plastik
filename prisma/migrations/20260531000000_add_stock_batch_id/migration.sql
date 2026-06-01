-- AlterTable
ALTER TABLE `StockIn` ADD COLUMN `batchId` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `StockOut` ADD COLUMN `batchId` VARCHAR(36) NULL;

-- Backfill barang masuk: setiap baris lama jadi batch sendiri agar pengelompokan tetap andal
UPDATE `StockIn` SET `batchId` = `id` WHERE `batchId` IS NULL;

-- Backfill barang keluar penjualan: kelompokkan ke id penjualan (samakan dengan logika baru)
UPDATE `StockOut` `so`
  JOIN `SaleItem` `si` ON `si`.`id` = `so`.`saleItemId`
  SET `so`.`batchId` = `si`.`saleId`
  WHERE `so`.`saleItemId` IS NOT NULL AND `so`.`batchId` IS NULL;

-- Backfill barang keluar manual: setiap baris lama jadi batch sendiri
UPDATE `StockOut` SET `batchId` = `id` WHERE `batchId` IS NULL;

-- CreateIndex
CREATE INDEX `StockIn_batchId_idx` ON `StockIn`(`batchId`);

-- CreateIndex
CREATE INDEX `StockOut_batchId_idx` ON `StockOut`(`batchId`);
