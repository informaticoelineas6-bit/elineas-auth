// Carga e integración mínima con el widget de Cloudflare Turnstile, sin
// depender de un wrapper de terceros: es una sola llamada `render`/`execute`
// sobre el script oficial, así que no vale la pena una dependencia extra.
export type TurnstileRenderOptions = {
	sitekey: string;
	size?: "normal" | "compact" | "flexible";
	// "interaction-only": el widget no ocupa espacio ni se muestra salvo que
	// Cloudflare decida interponer un reto interactivo. No existe un `size`
	// "invisible": ese comportamiento se controla con `appearance`.
	appearance?: "always" | "execute" | "interaction-only";
	execution?: "render" | "execute";
	callback?: (token: string) => void;
	"error-callback"?: () => void;
	"expired-callback"?: () => void;
};

declare global {
	interface Window {
		turnstile?: {
			render: (
				container: HTMLElement,
				options: TurnstileRenderOptions,
			) => string;
			execute: (widgetId: string) => void;
			reset: (widgetId: string) => void;
			remove: (widgetId: string) => void;
		};
	}
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptPromise: Promise<void> | null = null;

// Idempotente: puede llamarse varias veces (remounts, Strict Mode) sin
// insertar el script dos veces ni rechazar promesas ya resueltas.
export function loadTurnstileScript(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.reject(
			new Error("Turnstile solo puede cargarse en el navegador"),
		);
	}
	if (window.turnstile) return Promise.resolve();
	if (scriptPromise) return scriptPromise;

	scriptPromise = new Promise((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			`script[src="${SCRIPT_SRC}"]`,
		);
		if (existing) {
			existing.addEventListener("load", () => resolve());
			existing.addEventListener("error", () =>
				reject(new Error("No se pudo cargar Turnstile")),
			);
			return;
		}
		const script = document.createElement("script");
		script.src = SCRIPT_SRC;
		script.async = true;
		script.defer = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("No se pudo cargar Turnstile"));
		document.head.appendChild(script);
	});
	return scriptPromise;
}
