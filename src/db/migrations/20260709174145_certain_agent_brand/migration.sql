CREATE TABLE "empleado" (
	"id" text PRIMARY KEY,
	"user_id" text UNIQUE,
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"documento_identidad" text NOT NULL UNIQUE,
	"fecha_nacimiento" timestamp,
	"telefono" text,
	"direccion" text,
	"fecha_ingreso" timestamp,
	"fecha_egreso" timestamp,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rol" (
	"id" text PRIMARY KEY,
	"sistema_id" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sistema" (
	"id" text PRIMARY KEY,
	"nombre" text NOT NULL UNIQUE,
	"codigo" text NOT NULL UNIQUE,
	"descripcion" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario_rol" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"rol_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "empleado_userId_idx" ON "empleado" ("user_id");--> statement-breakpoint
CREATE INDEX "rol_sistemaId_idx" ON "rol" ("sistema_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rol_sistemaId_nombre_uidx" ON "rol" ("sistema_id","nombre");--> statement-breakpoint
CREATE INDEX "usuarioRol_userId_idx" ON "usuario_rol" ("user_id");--> statement-breakpoint
CREATE INDEX "usuarioRol_rolId_idx" ON "usuario_rol" ("rol_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarioRol_userId_rolId_uidx" ON "usuario_rol" ("user_id","rol_id");--> statement-breakpoint
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "rol" ADD CONSTRAINT "rol_sistema_id_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistema"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_rol_id_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE CASCADE;