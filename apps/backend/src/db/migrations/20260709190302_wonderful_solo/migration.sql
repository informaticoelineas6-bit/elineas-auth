CREATE TABLE "session_system" (
	"session_id" text PRIMARY KEY,
	"system_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sessionSystem_systemId_idx" ON "session_system" ("system_id");--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_system_id_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "system"("id") ON DELETE CASCADE;