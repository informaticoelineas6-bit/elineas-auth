import { useCallback, useEffect, useRef } from "react";
import { loadTurnstileScript } from "./turnstile-client.ts";

// Widget invisible de Cloudflare Turnstile: no se ve ni se interactúa (salvo
// que Cloudflare, en un caso excepcional, decida mostrar un reto). Con
// `siteKey` null (Turnstile no configurado) es un no-op: `getToken` resuelve
// con cadena vacía y signInFn no exige token cuando no hay secret configurado.
export function useTurnstile(siteKey: string | null) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetId = useRef<string | null>(null);
	const pending = useRef<{
		resolve: (token: string) => void;
		reject: (error: Error) => void;
	} | null>(null);

	useEffect(() => {
		if (!siteKey) return;
		let cancelled = false;

		loadTurnstileScript()
			.then(() => {
				if (cancelled || !containerRef.current || !window.turnstile) return;
				widgetId.current = window.turnstile.render(containerRef.current, {
					sitekey: siteKey,
					size: "invisible",
					execution: "execute",
					callback: (token) => {
						pending.current?.resolve(token);
						pending.current = null;
					},
					"error-callback": () => {
						pending.current?.reject(new Error("No se pudo verificar el captcha"));
						pending.current = null;
					},
					"expired-callback": () => {
						pending.current?.reject(
							new Error("El captcha expiró, intenta de nuevo"),
						);
						pending.current = null;
					},
				});
			})
			.catch(() => {
				// Sin bloquear el login si Turnstile no carga (red, adblock…): el
				// servidor rechazará el intento igualmente si el secret está
				// configurado, con un mensaje claro.
			});

		return () => {
			cancelled = true;
			if (widgetId.current && window.turnstile) {
				window.turnstile.remove(widgetId.current);
				widgetId.current = null;
			}
		};
	}, [siteKey]);

	const getToken = useCallback((): Promise<string> => {
		if (!siteKey) return Promise.resolve("");
		if (!widgetId.current || !window.turnstile) {
			return Promise.reject(
				new Error("El captcha aún no está listo. Espera un segundo e intenta de nuevo."),
			);
		}
		const id = widgetId.current;
		const turnstile = window.turnstile;
		return new Promise((resolve, reject) => {
			pending.current = { resolve, reject };
			turnstile.reset(id);
			turnstile.execute(id);
		});
	}, [siteKey]);

	return { containerRef, getToken };
}
