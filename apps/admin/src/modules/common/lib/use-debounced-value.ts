import { useEffect, useState } from "react";

// Devuelve `value` con un retardo de `delayMs`: cada cambio reinicia el
// temporizador, de modo que el valor solo se "asienta" cuando el usuario deja
// de escribir. Base de la búsqueda con debounce de los listados.
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const id = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(id);
	}, [value, delayMs]);

	return debounced;
}
