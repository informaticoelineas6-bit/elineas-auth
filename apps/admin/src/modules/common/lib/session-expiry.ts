// Puente entre la capa de datos (QueryClient) y el router para el 401 global.
// El QueryClient no conoce el router; cuando cualquier query o mutación falla
// con 401 (sesión muerta), notifica aquí y el router —que se registra al
// arrancar— redirige al login conservando la ruta de origen.
type Handler = () => void;

let handler: Handler | null = null;

// Registra el manejador (lo hace el router una sola vez). Devuelve una función
// para desregistrar.
export function onSessionExpired(next: Handler): () => void {
	handler = next;
	return () => {
		if (handler === next) handler = null;
	};
}

// La notificación se colapsa: si ya hay una redirección en curso no se dispara
// otra (evita un bucle si varias queries fallan a la vez con 401).
let notifying = false;

export function notifySessionExpired(): void {
	if (notifying || !handler) return;
	notifying = true;
	try {
		handler();
	} finally {
		// Se libera en el siguiente tick: las notificaciones simultáneas del mismo
		// fallo se ignoran, pero un 401 posterior (nueva sesión caducada) sí actúa.
		queueMicrotask(() => {
			notifying = false;
		});
	}
}
