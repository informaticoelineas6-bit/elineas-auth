import type { auth } from "@/lib/auth";
import type { AuditableLogger } from "evlog";

export type SessionResult = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type AppEnv = {
  Variables: {
    user: SessionResult["user"];
    session: SessionResult["session"];
    // Logger de la petición que inyecta el middleware de evlog (evlog/hono).
    // Disponible en rutas /api/*; `c.get("log").set({...})` acumula campos en el
    // wide event que se emite al terminar la respuesta.
    log: AuditableLogger;
  };
};
