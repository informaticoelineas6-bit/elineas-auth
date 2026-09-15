CREATE TABLE "tkc_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"username" text NOT NULL UNIQUE,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tkc_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL UNIQUE,
	"tkc_key_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "userTkcKey_tkcKeyId_idx" ON "user_tkc_key" ("tkc_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "userTkcKey_userId_tkcKeyId_uidx" ON "user_tkc_key" ("user_id","tkc_key_id");--> statement-breakpoint
ALTER TABLE "user_tkc_key" ADD CONSTRAINT "user_tkc_key_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_tkc_key" ADD CONSTRAINT "user_tkc_key_tkc_key_id_tkc_key_id_fkey" FOREIGN KEY ("tkc_key_id") REFERENCES "tkc_key"("id") ON DELETE CASCADE;