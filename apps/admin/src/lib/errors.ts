import { toast } from "sonner";

const FALLBACK_MESSAGE = "Ocurrió un error inesperado. Intenta nuevamente.";

export function getErrorMessage(error: unknown, fallback = FALLBACK_MESSAGE) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return fallback;
}

// Punto único donde los errores de la app se convierten en feedback visible:
// cada catch/onError de la app llama a esto en vez de armar su propio toast.
export function reportError(error: unknown, fallback?: string) {
	toast.error(getErrorMessage(error, fallback));
}
