ALTER TABLE "empleado" RENAME TO "employee";--> statement-breakpoint
ALTER TABLE "rol" RENAME TO "role";--> statement-breakpoint
ALTER TABLE "sistema" RENAME TO "system";--> statement-breakpoint
ALTER TABLE "usuario_rol" RENAME TO "user_role";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "nombre" TO "name";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "apellido" TO "last_name";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "documento_identidad" TO "ci";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "fecha_nacimiento" TO "birthday";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "telefono" TO "phone_number";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "direccion" TO "address";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "fecha_ingreso" TO "in_date";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "fecha_egreso" TO "out_date";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "activo" TO "active";--> statement-breakpoint
ALTER TABLE "role" RENAME COLUMN "sistema_id" TO "systemId";--> statement-breakpoint
ALTER TABLE "role" RENAME COLUMN "nombre" TO "name";--> statement-breakpoint
ALTER TABLE "role" RENAME COLUMN "descripcion" TO "description";--> statement-breakpoint
ALTER TABLE "system" RENAME COLUMN "nombre" TO "name";--> statement-breakpoint
ALTER TABLE "system" RENAME COLUMN "codigo" TO "slug";--> statement-breakpoint
ALTER TABLE "system" RENAME COLUMN "descripcion" TO "description";--> statement-breakpoint
ALTER TABLE "system" RENAME COLUMN "activo" TO "active";--> statement-breakpoint
ALTER INDEX "empleado_userId_idx" RENAME TO "employee_userId_idx";--> statement-breakpoint
ALTER INDEX "rol_sistemaId_idx" RENAME TO "role_systemId_idx";--> statement-breakpoint
ALTER INDEX "rol_sistemaId_nombre_uidx" RENAME TO "role_systemId_name_uidx";--> statement-breakpoint
ALTER INDEX "usuarioRol_userId_idx" RENAME TO "userRole_userId_idx";--> statement-breakpoint
ALTER INDEX "usuarioRol_rolId_idx" RENAME TO "userRole_roleId_idx";--> statement-breakpoint
ALTER INDEX "usuarioRol_userId_rolId_uidx" RENAME TO "userRole_userId_roleId_uidx";