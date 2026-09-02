import { useEffect, useState } from "react";

// Devuelve true cuando la página se ha desplazado más allá de `threshold` px.
// Lo usa la cabecera para pasar de transparente a opaca/con blur al hacer scroll.
export function useScrolled(threshold = 8): boolean {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > threshold);
		// Sincroniza el estado inicial por si la página carga ya desplazada.
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [threshold]);

	return scrolled;
}
