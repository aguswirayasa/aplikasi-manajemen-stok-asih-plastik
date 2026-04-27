-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `telegramChatId` VARCHAR(191) NULL,
    ADD COLUMN `telegramUsername` VARCHAR(191) NULL,
    ADD COLUMN `telegramLinkedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `TelegramLinkToken` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TelegramLinkToken_tokenHash_key`(`tokenHash`),
    INDEX `TelegramLinkToken_userId_idx`(`userId`),
    INDEX `TelegramLinkToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_telegramChatId_key` ON `User`(`telegramChatId`);

-- AddForeignKey
ALTER TABLE `TelegramLinkToken` ADD CONSTRAINT `TelegramLinkToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
