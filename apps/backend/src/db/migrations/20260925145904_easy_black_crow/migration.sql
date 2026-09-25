CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "permission_resource_action_uidx" ON "permission" ("resource","action");--> statement-breakpoint
CREATE INDEX "rolePermission_roleId_idx" ON "role_permission" ("role_id");--> statement-breakpoint
CREATE INDEX "rolePermission_permissionId_idx" ON "role_permission" ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rolePermission_roleId_permissionId_uidx" ON "role_permission" ("role_id","permission_id");--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE;