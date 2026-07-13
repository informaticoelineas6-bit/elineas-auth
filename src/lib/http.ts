import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { auth } from "@/lib/auth";

const FORWARDED_HEADERS = ["set-auth-token", "set-auth-jwt", "access-control-expose-headers"];

export function forwardAuthHeaders(c: Context, headers: Headers | undefined) {
  if (!headers) return;
  for (const cookie of headers.getSetCookie?.() ?? []) {
    c.header("Set-Cookie", cookie, { append: true });
  }
  for (const name of FORWARDED_HEADERS) {
    const value = headers.get(name);
    if (value) c.header(name, value);
  }
}

export async function issueJwt(sessionToken: string | null | undefined) {
  if (!sessionToken) return null;
  const { token } = await auth.api.getToken({
    headers: new Headers({ authorization: `Bearer ${sessionToken}` }),
  });
  return token;
}

// Error de dominio que los servicios pueden lanzar para producir una respuesta
// HTTP concreta (404, 400, 403, ...). Lo mapea `handleError`.
export class HttpError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

type ApiError = { statusCode: number; body?: { message?: string; code?: string } };

function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && "statusCode" in error;
}

// Extrae el SQLSTATE (code de 5 caracteres) de un error de Postgres. drizzle
// envuelve el error nativo, por lo que el code puede estar en el propio error
// o en su `cause`.
function getPgCode(error: unknown): string | undefined {
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      typeof (candidate as { code: unknown }).code === "string" &&
      (candidate as { code: string }).code.length === 5
    ) {
      return (candidate as { code: string }).code;
    }
  }
  return undefined;
}

// Manejador de errores único para toda la API. Se registra con `app.onError`,
// de modo que cualquier handler puede simplemente lanzar y aquí se traduce.
export function handleError(error: unknown, c: Context) {
  // El status se emite como `any` a propósito: estos errores se devuelven desde
  // handlers registrados con `.openapi()`, cuyo tipado no puede estrechar el
  // status en tiempo de ejecución a un literal concreto de la ruta.
  const json = (body: { error: string; code?: string }, status: ContentfulStatusCode) =>
    c.json(body, status as any);

  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  // HTTPException de Hono (p. ej. el 504 del middleware `timeout`). Se respeta su
  // status en vez de degradarlo al 500 genérico del final.
  if (error instanceof HTTPException) {
    return json({ error: error.message, code: "HTTP_EXCEPTION" }, error.status);
  }
  if (isApiError(error)) {
    return json(
      { error: error.body?.message ?? "Error de autenticación", code: error.body?.code },
      error.statusCode as ContentfulStatusCode,
    );
  }
  switch (getPgCode(error)) {
    case "23505": // unique_violation
      return json(
        { error: "El recurso ya existe (violación de unicidad)", code: "CONFLICT" },
        409,
      );
    case "23503": // foreign_key_violation
      return json(
        { error: "Referencia inválida a otro recurso", code: "FK_VIOLATION" },
        400,
      );
    case "23502": // not_null_violation
      return json({ error: "Falta un campo obligatorio", code: "NOT_NULL" }, 400);
  }
  console.error("Error no controlado:", error);
  return json({ error: "Error interno del servidor", code: "INTERNAL" }, 500);
}

// Compat: los servicios de auth existentes lo usan dentro de su try/catch.
export function handleAuthError(c: Context, error: unknown) {
  return handleError(error, c);
}
