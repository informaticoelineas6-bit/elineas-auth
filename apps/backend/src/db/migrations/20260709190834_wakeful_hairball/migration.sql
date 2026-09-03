ALTER TABLE "session_system" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sessionSystem_userId_systemId_uidx" ON "session_system" ("user_id","system_id");--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;