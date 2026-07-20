import { toast } from "sonner";

const FALLBACK_MESSAGE = "Ocurrió un error inesperado. Intenta nuevamente.";

// Mapa central código de negocio del IS → mensaje en español. Se usa como
// respaldo cuando solo se dispone del `code` (o para uniformar el copy); el
// mensaje que envía el IS —también en español— tiene prioridad en getErrorMessage.
const ERROR_MESSAGES: Record<string, string> = {
	UNAUTHORIZED: "Tu sesión expiró. Vuelve a iniciar sesión.",
	FORBIDDEN: "No tienes permisos para realizar esta acción.",
	RATE_LIMITED:
		"Demasiadas solicitudes. Espera unos segundos antes de reintentar.",
	CONFLICT: "El recurso entra en conflicto con otro existente.",
	SYSTEM_NOT_FOUND: "El sistema indicado no existe.",
	SYSTEM_REQUIRED: "Debes indicar un sistema.",
};

// Mensaje en español para un código de negocio del IS (o undefined si no está
// en el mapa).
export function messageForCode(code: string | undefined): string | undefined {
	return code ? ERROR_MESSAGES[code] : undefined;
}

export function getErrorMessage(error: unknown, fallback = FALLBACK_MESSAGE) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	// Sin mensaje textual pero con código conocido: usa el copy central.
	const byCode = messageForCode(getErrorCode(error));
	if (byCode) return byCode;
	return fallback;
}

// El status HTTP del IS (AuthApiError) sobrevive la serialización del server fn
// como propiedad del Error (seroval), aunque no la clase. Permite reaccionar a
// códigos concretos en cliente (p. ej. 403 → pantalla "sin permisos").
export function getErrorStatus(error: unknown): number | undefined {
	if (error && typeof error === "object" && "status" in error) {
		const { status } = error as { status: unknown };
		if (typeof status === "number") return status;
	}
	return undefined;
}

// Segundos hasta poder reintentar (cabecera Retry-After de los 429 del IS).
// Sobrevive la serialización del server fn como propiedad del Error.
export function getErrorRetryAfter(error: unknown): number | undefined {
	if (error && typeof error === "object" && "retryAfter" in error) {
		const { retryAfter } = error as { retryAfter: unknown };
		if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
			return retryAfter;
		}
	}
	return undefined;
}

// Código de error de negocio del IS (p. ej. "CONFLICT", "RATE_LIMITED").
export function getErrorCode(error: unknown): string | undefined {
	if (error && typeof error === "object" && "code" in error) {
		const { code } = error as { code: unknown };
		if (typeof code === "string") return code;
	}
	return undefined;
}

// Punto único donde los errores de la app se convierten en feedback visible:
// cada catch/onError de la app llama a esto en vez de armar su propio toast.
export function reportError(error: unknown, fallback?: string) {
	toast.error(getErrorMessage(error, fallback));
}

export function isRateLimited(error: unknown): boolean {
	return getErrorStatus(error) === 429;
}

// Convención para el 429: lee el Retry-After, arranca una cuenta atrás (que
// bloquea el reintento en el formulario) y avisa con el tiempo real de espera.
// `startCountdown` es el `start` de useCountdown. Devuelve los segundos.
export function reportRateLimited(
	error: unknown,
	startCountdown: (seconds: number) => void,
): number {
	const seconds = getErrorRetryAfter(error) ?? 60;
	startCountdown(seconds);
	toast.error(`Demasiados intentos. Espera ${seconds}s antes de reintentar.`);
	return seconds;
}
