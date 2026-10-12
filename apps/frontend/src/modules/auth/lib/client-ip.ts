import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

// Este panel llama al IS de servidor a servidor, así que, sin esto, el IS ve
// siempre la IP del contenedor del panel: todos los logins comparten un único
// bucket de rate limit (y un atacante podría bloquear cualquier cuenta con unos
// pocos intentos) y los logs/sesiones pierden la IP real de origen.
//
// Se reenvía la IP del cliente en X-Forwarded-For. Detrás de un único proxy de
// confianza (cloudflared) el valor fiable es el ÚLTIMO de la cabecera, porque
// el proxy añade al final y todo lo anterior lo pudo inyectar el cliente. Debe
// coincidir con TRUST_PROXY_HOPS=1 del IS, que lee de derecha a izquierda.
export function clientForwardHeaders(): Record<string, string> {
	const forwarded = getRequestHeader("x-forwarded-for");
	const last = forwarded
		?.split(",")
		.map((value) => value.trim())
		.filter(Boolean)
		.at(-1);
	const ip = last ?? getRequestIP();
	return ip ? { "X-Forwarded-For": ip } : {};
}
