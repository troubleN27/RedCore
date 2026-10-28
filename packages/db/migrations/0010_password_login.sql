-- Вход по логину и паролю: без 2FA и подтверждения телефона по SMS
DROP TABLE "two_factor" CASCADE;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "phone_number_verified";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "two_factor_enabled";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "admin_audit_log" RENAME COLUMN "actor_email" TO "actor_login";--> statement-breakpoint
-- Логины для уже существующих аккаунтов: персонал из seed и покупатели по номеру телефона
UPDATE "user" SET "username" = 'admin' WHERE "id" = 'demo-admin';--> statement-breakpoint
UPDATE "user" SET "username" = 'manager' WHERE "id" = 'demo-manager';--> statement-breakpoint
UPDATE "user" SET "username" = substr("phone_number", 2)
  WHERE "username" IS NULL AND "role" = 'customer' AND "phone_number" ~ '^\+998[0-9]{9}$';
