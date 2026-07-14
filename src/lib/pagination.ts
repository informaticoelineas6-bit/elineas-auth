// Utilidades de paginación compartidas por todos los endpoints de listado.
// La convención es `page` (1-indexado) + `limit`, y una respuesta que además
// del array de recursos incluye un objeto `pagination` con los totales, para
// que el cliente pueda construir controles de paginación sin más llamadas.

export type PaginationInput = { page: number; limit: number };

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// Convierte page/limit a offset para la consulta SQL.
export function toOffset({ page, limit }: PaginationInput): number {
  return (page - 1) * limit;
}

// Calcula los metadatos de paginación a partir del total de filas. Con 0 filas
// devuelve totalPages = 0 (no hay ninguna página que recorrer).
export function paginationMeta(
  { page, limit }: PaginationInput,
  total: number,
): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
