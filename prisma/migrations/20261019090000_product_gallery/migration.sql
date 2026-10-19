-- Produktgalerie: mehrere Bilder pro Produkt statt eines einzelnen Bildes.

-- CreateTable
CREATE TABLE `product_images` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `mediaId` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(60) NOT NULL DEFAULT '',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_images_productId_sortOrder_idx`(`productId`, `sortOrder`),
    INDEX `product_images_mediaId_idx`(`mediaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Vorhandene Einzelbilder werden zum ersten Galeriebild. Die ID muss nur eindeutig sein;
-- neue Einträge bekommen ihre cuid wie gewohnt von Prisma.
INSERT INTO `product_images` (`id`, `productId`, `mediaId`, `caption`, `sortOrder`)
SELECT CONCAT('mig', REPLACE(UUID(), '-', '')), `id`, `imageId`, '', 0
FROM `products`
WHERE `imageId` IS NOT NULL;

-- DropForeignKey
ALTER TABLE `products` DROP FOREIGN KEY `products_imageId_fkey`;

-- DropIndex
DROP INDEX `products_imageId_idx` ON `products`;

-- AlterTable
ALTER TABLE `products` DROP COLUMN `imageId`,
    ADD COLUMN `model` VARCHAR(120) NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `media_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
