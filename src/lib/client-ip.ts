import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import { env } from "@/config/env";

// IP del cliente. Por defecto usa la IP real del socket (getConnInfo), que NO es
// falsificable por el cliente. La cabecera X-Forwarded-For solo se tiene en
// cuenta si TRUST_PROXY_HOPS > 0, es decir, cuando la API está detrás de un nº
// conocido de proxies de confianza.
//
// Confiar ciegamente en XFF permitiría a un atacante rotar la cabecera en cada
// petición y obtener una IP nueva cada vez (anulando p. ej. el rate limiting por
// IP). Por eso se lee de DERECHA a IZQUIERDA: cada proxy AÑADE al final, así que
// el valor que puso nuestro proxy de confianza más externo (a `hops` posiciones
// del final) es el único que el cliente no puede forjar.
//
// Compartida por el rate limiter (middleware/rate-limit.ts) y el request-logging
// (middleware/request-log.ts) para que ambos calculen la IP igual.
export function clientIp(c: Context): string {
  const socketIp = getConnInfo(c).remote.address ?? "unknown";

  const hops = env.TRUST_PROXY_HOPS;
  if (hops <= 0) return socketIp;

  const forwarded = c.req.header("x-forwarded-for");
  if (!forwarded) return socketIp;

  const parts = forwarded
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // El valor fiable es el que añadió el proxy de confianza más externo: a
  // `hops` posiciones contando desde el final. Todo lo que haya a su izquierda
  // lo pudo inyectar el cliente y se ignora.
  const index = parts.length - hops;
  return parts[index] ?? socketIp;
}
