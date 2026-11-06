-- El catálogo de permisos pasa de global a POR SISTEMA (permission.system_id).
-- Migración de datos escrita a mano sobre lo que genera drizzle-kit:
--   * un permiso enlazado (role_permission) a roles de N sistemas se divide en
--     N filas, una por sistema, y se re-apuntan los role_permission;
--   * un permiso sin ningún enlace pasa al sistema 'auth' (slug fijo: es el
--     sistema del propio IS, no sigue a ADMIN_SYSTEM_SLUG).
DROP INDEX "permission_resource_action_uidx";--> statement-breakpoint
ALTER TABLE "permission" ADD COLUMN "system_id" uuid;--> statement-breakpoint
CREATE TEMP TABLE "perm_split" AS
SELECT
  d.permission_id,
  d.system_id,
  row_number() OVER (
    PARTITION BY d.permission_id
    ORDER BY (s.slug = 'auth') DESC, s.created_at, s.id
  ) AS rn,
  NULL::uuid AS new_id
FROM (
  SELECT DISTINCT rp.permission_id, r.system_id
  FROM "role_permission" rp
  JOIN "role" r ON r.id = rp.role_id
) d
JOIN "system" s ON s.id = d.system_id;--> statement-breakpoint
UPDATE "permission" p
SET "system_id" = ps.system_id
FROM "perm_split" ps
WHERE ps.permission_id = p.id AND ps.rn = 1;--> statement-breakpoint
UPDATE "perm_split" SET new_id = gen_random_uuid() WHERE rn > 1;--> statement-breakpoint
INSERT INTO "permission" ("id", "system_id", "resource", "action", "description", "created_at")
SELECT ps.new_id, ps.system_id, p.resource, p.action, p.description, p.created_at
FROM "perm_split" ps
JOIN "permission" p ON p.id = ps.permission_id
WHERE ps.rn > 1;--> statement-breakpoint
UPDATE "role_permission" rp
SET "permission_id" = ps.new_id
FROM "role" r, "perm_split" ps
WHERE r.id = rp.role_id
  AND ps.permission_id = rp.permission_id
  AND ps.system_id = r.system_id
  AND ps.rn > 1;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "permission" WHERE "system_id" IS NULL)
     AND NOT EXISTS (SELECT 1 FROM "system" WHERE "slug" = 'auth') THEN
    RAISE EXCEPTION 'Hay permisos sin enlazar a ningún rol y no existe el sistema "auth" al que asignarlos';
  END IF;
END $$;--> statement-breakpoint
UPDATE "permission"
SET "system_id" = (SELECT "id" FROM "system" WHERE "slug" = 'auth')
WHERE "system_id" IS NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "role_permission" rp
    JOIN "role" r ON r.id = rp.role_id
    JOIN "permission" p ON p.id = rp.permission_id
    WHERE r.system_id <> p.system_id
  ) THEN
    RAISE EXCEPTION 'Quedan role_permission que mezclan sistemas tras dividir el catálogo';
  END IF;
END $$;--> statement-breakpoint
DROP TABLE "perm_split";--> statement-breakpoint
ALTER TABLE "permission" ALTER COLUMN "system_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "permission_systemId_idx" ON "permission" ("system_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_systemId_resource_action_uidx" ON "permission" ("system_id","resource","action");--> statement-breakpoint
ALTER TABLE "permission" ADD CONSTRAINT "permission_system_id_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "system"("id") ON DELETE CASCADE;
