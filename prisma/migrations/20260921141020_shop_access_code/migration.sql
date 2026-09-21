-- AlterTable
ALTER TABLE `settings` ADD COLUMN `accessCodeHash` TEXT NULL,
    ADD COLUMN `accessHint` TEXT NULL;
