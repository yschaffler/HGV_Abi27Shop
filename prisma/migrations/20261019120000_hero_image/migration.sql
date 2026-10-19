-- Eigenes Cover fuer den Hero der Startseite.

-- AlterTable
ALTER TABLE `settings` ADD COLUMN `heroImageId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `settings_heroImageId_idx` ON `settings`(`heroImageId`);

-- AddForeignKey
ALTER TABLE `settings` ADD CONSTRAINT `settings_heroImageId_fkey` FOREIGN KEY (`heroImageId`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
