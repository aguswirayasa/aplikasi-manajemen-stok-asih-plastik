-- AlterTable
ALTER TABLE `Product`
  ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `archivedAt` DATETIME(3) NULL;
