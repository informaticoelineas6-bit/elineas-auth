DELETE FROM "permission" WHERE "resource" = 'tkc';--> statement-breakpoint
ALTER TABLE "user_tkc_key" DROP CONSTRAINT "user_tkc_key_tkc_key_id_tkc_key_id_fkey";--> statement-breakpoint
DROP TABLE "tkc_key";--> statement-breakpoint
DROP TABLE "user_tkc_key";
