-- AlterTable
-- VARCHAR statt TEXT: MySQL lehnt einen Standardwert an TEXT-Spalten ab (Fehler 1101).
ALTER TABLE `settings` ADD COLUMN `sizeAdvice` VARCHAR(1000) NOT NULL DEFAULT '';
