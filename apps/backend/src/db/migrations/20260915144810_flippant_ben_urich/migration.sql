-- Una credencial de TKC pasa a pertenecer como mucho a UN usuario: el UNIQUE
-- sobre `tkc_key_id` cierra la relación 1 a 1 que ya tenía por el lado de
-- `user_id` y, junto con el UNIQUE de `tkc_key.username`, impide que dos
-- personas declaren la misma cuenta de TKC.
--
-- Sin backfill a propósito: `user_tkc_key` se creó en la migración anterior
-- (20260915142940) y la función aún no se ha usado, así que no puede haber
-- filas que compartan `tkc_key_id`. Si las hubiera, este ALTER fallaría en vez
-- de descartar ninguna en silencio, que es el comportamiento correcto: hay que
-- decidir a mano quién se queda con la credencial.
--
-- Los dos índices que se borran quedan cubiertos por la nueva restricción: un
-- UNIQUE crea su propio índice sobre `tkc_key_id`, y el compuesto
-- (user_id, tkc_key_id) es redundante en cuanto cada columna es única por sí
-- sola.
DROP INDEX "userTkcKey_tkcKeyId_idx";--> statement-breakpoint
DROP INDEX "userTkcKey_userId_tkcKeyId_uidx";--> statement-breakpoint
ALTER TABLE "user_tkc_key" ADD CONSTRAINT "user_tkc_key_tkc_key_id_key" UNIQUE("tkc_key_id");
