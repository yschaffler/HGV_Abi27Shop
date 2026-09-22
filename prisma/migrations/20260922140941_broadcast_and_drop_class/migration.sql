/*
  Warnings:

  - You are about to drop the column `className` on the `orders` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `orders_className_idx` ON `orders`;

-- AlterTable
ALTER TABLE `orders` DROP COLUMN `className`,
    ADD COLUMN `paymentAttempts` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `broadcasts` (
    `id` VARCHAR(191) NOT NULL,
    `subject` TEXT NOT NULL,
    `body` TEXT NOT NULL,
    `audience` ENUM('PAID', 'PAID_NOT_DISTRIBUTED') NOT NULL,
    `status` ENUM('DRAFT', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `recipientCount` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    INDEX `broadcasts_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broadcast_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `broadcastId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `error` TEXT NULL,

    UNIQUE INDEX `broadcast_deliveries_broadcastId_orderId_key`(`broadcastId`, `orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `broadcasts` ADD CONSTRAINT `broadcasts_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_deliveries` ADD CONSTRAINT `broadcast_deliveries_broadcastId_fkey` FOREIGN KEY (`broadcastId`) REFERENCES `broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broadcast_deliveries` ADD CONSTRAINT `broadcast_deliveries_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
