import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { userRolesQueries } from "../queries/user-roles.ts";
import type { DirectoryUser } from "../shared/types.ts";

// Usuarios del directorio con búsqueda EN EL SERVIDOR (debounce de 250 ms): los
// selectores no cargan toda la organización, piden solo lo que coincide con lo
// escrito. Recuerda los usuarios ya vistos para que el elegido conserve su
// etiqueta aunque el siguiente resultado de búsqueda ya no lo incluya.
export function useUserDirectory({
	limit = 50,
	ensureId,
}: {
	limit?: number;
	// Usuario que debe poder mostrarse aunque no esté en la búsqueda actual
	// (p. ej. el preseleccionado desde un enlace).
	ensureId?: string;
} = {}) {
	const [search, setSearch] = useState("");
	const [debounced, setDebounced] = useState("");
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(search.trim()), 250);
		return () => clearTimeout(timer);
	}, [search]);

	const query = useQuery({
		...userRolesQueries.directory({
			search: debounced || undefined,
			limit,
		}),
		placeholderData: keepPreviousData,
	});

	const ensured = useQuery({
		...userRolesQueries.directory({ userId: ensureId, limit: 1 }),
		enabled: Boolean(ensureId),
	});

	const seen = useRef(new Map<string, DirectoryUser>());
	const users = query.data?.users ?? [];
	for (const user of ensured.data?.users ?? []) seen.current.set(user.id, user);
	for (const user of users) seen.current.set(user.id, user);

	// Resultados actuales + los ya elegidos (aunque hayan salido del resultado).
	// Función simple (no memoizada): lee la caché de "ya vistos", que es un ref.
	function optionsFor(selectedIds: string[]) {
		const merged = new Map<string, DirectoryUser>();
		for (const id of selectedIds) {
			const user = seen.current.get(id);
			if (user) merged.set(id, user);
		}
		for (const user of users) merged.set(user.id, user);
		return [...merged.values()].map((user) => ({
			value: user.id,
			label: user.employeeName ?? user.name,
			description: user.email,
		}));
	}

	return {
		users,
		// Usuario ya visto en cualquier búsqueda (para nombrar a los seleccionados).
		lookup: (id: string) => seen.current.get(id),
		search,
		setSearch,
		optionsFor,
		isPending: query.isPending,
		isSearching: query.isFetching,
		isError: query.isError,
	};
}
