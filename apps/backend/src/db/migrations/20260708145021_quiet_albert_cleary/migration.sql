ALTER TABLE "invitation" DROP CONSTRAINT "invitation_organization_id_organization_id_fkey";--> statement-breakpoint
ALTER TABLE "member" DROP CONSTRAINT "member_organization_id_organization_id_fkey";--> statement-breakpoint
DROP TABLE "invitation";--> statement-breakpoint
DROP TABLE "member";--> statement-breakpoint
DROP TABLE "organization";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "impersonated_by";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "active_organization_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "banned";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ban_reason";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ban_expires";