import { useCallback, useEffect, useRef, useState } from "react";

// Cuenta atrás en segundos, útil para bloquear una acción tras un 429 hasta que
// pase el Retry-After. `start(n)` (re)inicia la cuenta; `remaining` llega a 0 y
// se detiene solo. El intervalo se limpia al desmontar o al reiniciar.
export function useCountdown(): {
	remaining: number;
	active: boolean;
	start: (seconds: number) => void;
} {
	const [remaining, setRemaining] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const clear = useCallback(() => {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	const start = useCallback(
		(seconds: number) => {
			clear();
			if (seconds <= 0) {
				setRemaining(0);
				return;
			}
			setRemaining(Math.ceil(seconds));
			intervalRef.current = setInterval(() => {
				setRemaining((prev) => {
					if (prev <= 1) {
						clear();
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
		},
		[clear],
	);

	useEffect(() => clear, [clear]);

	return { remaining, active: remaining > 0, start };
}
