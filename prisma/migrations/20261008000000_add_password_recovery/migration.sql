ALTER TABLE `User`
  ADD COLUMN `email` VARCHAR(254) NULL,
  ADD COLUMN `passwordResetTokenHash` VARCHAR(64) NULL,
  ADD COLUMN `passwordResetExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0,
  ADD UNIQUE INDEX `User_email_key` (`email`),
  ADD UNIQUE INDEX `User_passwordResetTokenHash_key` (`passwordResetTokenHash`);
