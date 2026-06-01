-- Drop unused product image column. App code does not read or write this field.
ALTER TABLE `Product` DROP COLUMN `image`;
