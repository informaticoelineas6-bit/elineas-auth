ALTER TABLE "account" ADD COLUMN "issuer" text;
--> statement-breakpoint
-- Backfill: better-auth@1.7.2 exige `issuer` para casar una cuenta de
-- credenciales con `createLocalAccountIssuer("credential")` ("local:" +
-- providerId) en el login. Las cuentas creadas antes de esta migración no lo
-- tenían (el campo no existía) y sin este UPDATE ningún login funcionaría —
-- la comparación `account.issuer === "local:credential"` fallaría siempre
-- para cuentas preexistentes. Solo afecta a `provider_id = 'credential'`:
-- las cuentas OAuth (si las hubiera) usan su propio issuer, no este.
UPDATE "account" SET "issuer" = 'local:' || "provider_id"
  WHERE "provider_id" = 'credential' AND "issuer" IS NULL;