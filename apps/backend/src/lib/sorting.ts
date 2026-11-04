import { asc, desc, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

type Orderable = PgColumn | SQL;

export type SortInput<K extends string> = {
  sortBy?: K;
  sortDir?: "asc" | "desc";
};

// Construye el ORDER BY de un listado. `columns` es la lista blanca de campos
// ordenables (ya validada en el esquema de la ruta); el criterio por defecto
// del recurso va siempre detrás como desempate, para que el orden sea estable
// entre páginas.
export function buildOrderBy<K extends string>(
  sort: SortInput<K> | undefined,
  columns: Record<K, Orderable>,
  fallback: Orderable[],
): Orderable[] {
  const fallbackOrder = fallback.map((c) => desc(c));
  if (!sort?.sortBy) return fallbackOrder;
  const direction = sort.sortDir === "desc" ? desc : asc;
  return [direction(columns[sort.sortBy]), ...fallbackOrder];
}
