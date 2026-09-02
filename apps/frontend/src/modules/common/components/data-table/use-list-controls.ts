import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/modules/common/lib/use-debounced-value.ts";
import type { ListControls, ListSearch } from "@/modules/common/shared/types";

// Forma mínima de search params que comparte todo listado (ver listSearchSchema).
// `page`/`limit` quedan cubiertos por el index signature (su tipo de entrada Zod
// es `unknown` por el coerce); cada recurso añade sus filtros por columna.

// Claves que NO cuentan como "filtro" a la hora de distinguir el estado vacío
// ("no hay datos") del vacío filtrado ("no hay resultados para este filtro").
const RESERVED_KEYS = new Set(["page", "limit"]);

/**
 * Sincroniza página / búsqueda / filtros de un listado con los search params de
 * TanStack Router. La URL es la única fuente de verdad: los listados quedan
 * enlazables y sobreviven a recargas y a los botones atrás/adelante.
 *
 * Uso típico en una ruta (con `validateSearch` = listSearchSchema del recurso):
 *
 *   const { filters, controls, setFilter } = useListControls<SystemFilters>();
 *   const query = useQuery(systemsQueries.list(filters));
 *   <DataTable {...controls} data={...} pagination={...} />
 */
export function useListControls<TSearch extends ListSearch = ListSearch>(
	options: { searchDebounceMs?: number } = {},
) {
	const { searchDebounceMs = 350 } = options;
	// strict:false → search params de la ruta actual sin acoplar el hook a una
	// ruta concreta (el cast del arg evita la fricción de los genéricos del router).
	const search = useSearch({ strict: false } as never) as TSearch;
	const navigate = useNavigate();

	const setParams = (updates: Record<string, unknown>) =>
		navigate({
			search: (prev: Record<string, unknown>) => ({ ...prev, ...updates }),
			replace: true,
		} as never);

	// La búsqueda se teclea en estado local y solo se vuelca a la URL tras el
	// debounce, evitando un fetch por pulsación.
	const [term, setTerm] = useState(search.search ?? "");
	const debouncedTerm = useDebouncedValue(term, searchDebounceMs);

	// biome-ignore lint/correctness/useExhaustiveDependencies: solo debe reaccionar al término ya "asentado".
	useEffect(() => {
		const next = debouncedTerm.trim() || undefined;
		if (next === (search.search ?? undefined)) return;
		// Cualquier cambio de búsqueda vuelve a la página 1.
		setParams({ search: next, page: 1 });
	}, [debouncedTerm]);

	// Si la URL cambia por fuera (enlace, atrás/adelante), re-hidrata el input.
	useEffect(() => {
		setTerm(search.search ?? "");
	}, [search.search]);

	// Hay filtro activo si existe cualquier search param distinto de page/limit.
	const isFiltered = Object.entries(search).some(
		([key, value]) =>
			!RESERVED_KEYS.has(key) &&
			value !== undefined &&
			value !== "" &&
			value !== null,
	);

	const controls: ListControls = {
		search: term,
		onSearchChange: setTerm,
		onPageChange: (page) => setParams({ page }),
		// Cambiar el tamaño de página vuelve a la página 1 para no quedar fuera de rango.
		onLimitChange: (limit) => setParams({ limit, page: 1 }),
		isFiltered,
	};

	return {
		/** Search params validados, listos para las query options del recurso. */
		filters: search,
		/** Props que consume <DataTable /> directamente (spread). */
		controls,
		/** Fija/limpia un filtro por columna (pasa `undefined` para limpiarlo). */
		setFilter: (key: string, value: unknown) =>
			setParams({ [key]: value, page: 1 }),
	};
}
