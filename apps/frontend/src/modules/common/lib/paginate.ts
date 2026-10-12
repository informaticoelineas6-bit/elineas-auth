// Recorre todas las páginas de un listado paginado en el servidor y devuelve el
// array completo (para exportar, no solo la página visible). La primera página
// revela `totalPages`; las demás se piden en paralelo con concurrencia acotada,
// porque el IS tiene rate limiting y una ráfaga sin límite dispararía 429.
const PAGE_LIMIT = 100;
const CONCURRENCY = 5;

export async function fetchAllPages<T>(
	fetchPage: (
		page: number,
		limit: number,
	) => Promise<{ rows: T[]; totalPages: number }>,
): Promise<T[]> {
	const first = await fetchPage(1, PAGE_LIMIT);
	const all = [...first.rows];
	if (first.totalPages <= 1) return all;

	const pages = Array.from({ length: first.totalPages - 1 }, (_, i) => i + 2);
	for (let i = 0; i < pages.length; i += CONCURRENCY) {
		const results = await Promise.all(
			pages
				.slice(i, i + CONCURRENCY)
				.map((page) => fetchPage(page, PAGE_LIMIT)),
		);
		for (const { rows } of results) all.push(...rows);
	}
	return all;
}
