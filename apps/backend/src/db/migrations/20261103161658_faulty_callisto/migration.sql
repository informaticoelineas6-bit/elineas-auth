CREATE TABLE "system_service_key" (
	"system_id" uuid PRIMARY KEY,
	"key_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_service_key" ADD CONSTRAINT "system_service_key_system_id_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "system"("id") ON DELETE CASCADE;