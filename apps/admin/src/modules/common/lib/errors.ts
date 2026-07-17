import { toast } from "sonner";

const FALLBACK_MESSAGE = "Ocurrió un error inesperado. Intenta nuevamente.";

export function getErrorMessage(error: unknown, fallback = FALLBACK_MESSAGE) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
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
