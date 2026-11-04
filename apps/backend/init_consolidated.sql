CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"issuer" text,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid UNIQUE,
	"name" text NOT NULL,
	"last_name" text NOT NULL,
	"ci" text UNIQUE,
	"birthday" timestamp,
	"phone_number" text,
	"address" text,
	"in_date" timestamp,
	"out_date" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"system_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_system" (
	"session_id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"system_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL UNIQUE,
	"slug" text NOT NULL UNIQUE,
	"description" text,
	"url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tkc_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"username" text NOT NULL UNIQUE,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tkc_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL UNIQUE,
	"tkc_key_id" uuid NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"stream_id" text NOT NULL UNIQUE,
	"ts" timestamp with time zone NOT NULL,
	"request_id" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"route_path" text,
	"status" integer NOT NULL,
	"duration_ms" real NOT NULL,
	"client_ip" text,
	"user_agent" text,
	"referer" text,
	"origin" text,
	"content_length" integer,
	"user_id" uuid,
	"session_id" uuid,
	"query" jsonb,
	"request_body" jsonb,
	"error" jsonb,
	"extra" jsonb
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
CREATE INDEX "employee_userId_idx" ON "employee" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_resource_action_uidx" ON "permission" ("resource","action");--> statement-breakpoint
CREATE INDEX "role_systemId_idx" ON "role" ("system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_systemId_name_uidx" ON "role" ("system_id","name");--> statement-breakpoint
CREATE INDEX "rolePermission_roleId_idx" ON "role_permission" ("role_id");--> statement-breakpoint
CREATE INDEX "rolePermission_permissionId_idx" ON "role_permission" ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rolePermission_roleId_permissionId_uidx" ON "role_permission" ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "sessionSystem_systemId_idx" ON "session_system" ("system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessionSystem_userId_systemId_uidx" ON "session_system" ("user_id","system_id");--> statement-breakpoint
CREATE INDEX "userRole_userId_idx" ON "user_role" ("user_id");--> statement-breakpoint
CREATE INDEX "userRole_roleId_idx" ON "user_role" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "userRole_userId_roleId_uidx" ON "user_role" ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "request_log_ts_idx" ON "request_log" ("ts");--> statement-breakpoint
CREATE INDEX "request_log_user_id_idx" ON "request_log" ("user_id");--> statement-breakpoint
CREATE INDEX "request_log_request_id_idx" ON "request_log" ("request_id");--> statement-breakpoint
CREATE INDEX "request_log_status_ts_idx" ON "request_log" ("status","ts");--> statement-breakpoint
CREATE INDEX "request_log_path_trgm_idx" ON "request_log" USING gin ("path" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_system_id_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "system"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_system_id_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "system"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_tkc_key" ADD CONSTRAINT "user_tkc_key_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_tkc_key" ADD CONSTRAINT "user_tkc_key_tkc_key_id_tkc_key_id_fkey" FOREIGN KEY ("tkc_key_id") REFERENCES "tkc_key"("id") ON DELETE CASCADE;