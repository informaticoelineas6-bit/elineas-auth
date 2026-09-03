-- Todos los ids del esquema pasan de text a uuid v4 (DEFAULT gen_random_uuid(),
-- nativa en PG13+). Ver src/db/auth-schema.ts y src/lib/auth.ts.
--
-- ============================ AVISO: MIGRACIÓN DESTRUCTIVA ==================
-- Este script BORRA todas las filas de las tablas de autenticación, de negocio
-- y de logs antes de cambiar los tipos. Es necesario, no una simplificación:
-- better-auth generaba los ids como cadenas aleatorias de 32 caracteres
-- (p. ej. "i2hM86tiSFfG4nikmexs8zkFkUk8Deud"), que NO son UUIDs válidos, así que
-- `id::uuid` falla con SQLSTATE 22P02 sobre los datos existentes.
-- Tras aplicarla hay que volver a poblar la BD:  bun run db:seed:local
-- (o db:seed:staging). Se pierden usuarios, contraseñas, sesiones, empleados,
-- sistemas, roles y el histórico de request_log.
-- ===========================================================================
--
-- El SQL que genera drizzle-kit para este cambio NO es aplicable tal cual: al
-- convertir una columna implicada en una FK, Postgres intenta recrear la
-- constraint y aborta mientras los dos lados tengan tipos distintos ("Key
-- columns ... are of incompatible types: text and uuid"). Por eso aquí las FKs
-- se eliminan antes de los ALTER y se recrean después, con los MISMOS nombres
-- (varios son heredados de un rename anterior: empleado_*, rol_sistema_*,
-- usuario_rol_*) para no dejar el snapshot de drizzle desincronizado.

-- 1. Vaciado. CASCADE cubre las dependencias entre estas tablas; se listan
-- todas explícitamente para que quede claro qué se borra.
TRUNCATE TABLE
  "session_system",
  "user_role",
  "employee",
  "role",
  "system",
  "session",
  "account",
  "verification",
  "jwks",
  "request_log",
  "user"
CASCADE;--> statement-breakpoint

-- 2. Fuera las FKs mientras los tipos de los dos lados no coincidan.
ALTER TABLE "account" DROP CONSTRAINT "account_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "employee" DROP CONSTRAINT "empleado_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "role" DROP CONSTRAINT "rol_sistema_id_sistema_id_fkey";--> statement-breakpoint
ALTER TABLE "user_role" DROP CONSTRAINT "usuario_rol_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "user_role" DROP CONSTRAINT "usuario_rol_rol_id_rol_id_fkey";--> statement-breakpoint
ALTER TABLE "session_system" DROP CONSTRAINT "session_system_session_id_session_id_fkey";--> statement-breakpoint
ALTER TABLE "session_system" DROP CONSTRAINT "session_system_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "session_system" DROP CONSTRAINT "session_system_system_id_system_id_fkey";--> statement-breakpoint

-- 3. Cambio de tipo. El USING es un no-op sobre tablas ya vacías, pero se deja
-- porque es el cast que exige Postgres para pasar de text a uuid.
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "jwks" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "jwks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "employee" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "employee" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "employee" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "system" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "system" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "role" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "role" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "role" ALTER COLUMN "system_id" SET DATA TYPE uuid USING "system_id"::uuid;--> statement-breakpoint
ALTER TABLE "user_role" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "user_role" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "user_role" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "user_role" ALTER COLUMN "role_id" SET DATA TYPE uuid USING "role_id"::uuid;--> statement-breakpoint
ALTER TABLE "session_system" ALTER COLUMN "session_id" SET DATA TYPE uuid USING "session_id"::uuid;--> statement-breakpoint
ALTER TABLE "session_system" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "session_system" ALTER COLUMN "system_id" SET DATA TYPE uuid USING "system_id"::uuid;--> statement-breakpoint

-- 4. request_log: la PK deja de ser el id de la entrada del Redis Stream y pasa
-- a ser un uuid propio. El id del stream se mueve a `stream_id`, cuyo UNIQUE es
-- lo que mantiene la idempotencia del worker de drenado (onConflictDoNothing).
-- El ADD COLUMN ... NOT NULL solo es válido porque el TRUNCATE dejó la tabla
-- vacía; con filas exigiría un DEFAULT.
ALTER TABLE "request_log" ADD COLUMN "stream_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "request_log" ADD CONSTRAINT "request_log_stream_id_key" UNIQUE("stream_id");--> statement-breakpoint
ALTER TABLE "request_log" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "request_log" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
-- user_id/session_id no llevan FK a propósito (ver log-schema.ts): solo se
-- alinea el tipo con las columnas a las que apuntan.
ALTER TABLE "request_log" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid;--> statement-breakpoint
ALTER TABLE "request_log" ALTER COLUMN "session_id" SET DATA TYPE uuid USING "session_id"::uuid;--> statement-breakpoint

-- 5. Recreación de las FKs, ya con uuid en los dos lados.
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "empleado_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "rol_sistema_id_sistema_id_fkey" FOREIGN KEY ("system_id") REFERENCES "system"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "usuario_rol_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "usuario_rol_rol_id_rol_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_system" ADD CONSTRAINT "session_system_system_id_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "system"("id") ON DELETE CASCADE;
