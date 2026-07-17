-- Extensión de trigramas: necesaria para el operador gin_trgm_ops del índice.
-- Requiere privilegios suficientes (el usuario del contenedor de Postgres los
-- tiene por ser el propietario de la BD). Idempotente por el IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "request_log_path_trgm_idx" ON "request_log" USING gin ("path" gin_trgm_ops);
