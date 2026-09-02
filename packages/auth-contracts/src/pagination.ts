import { z } from "zod";
import { searchTerm } from "./primitives.ts";

// Query de paginación compartida por todos los listados administrativos del IS
// (ver `apps/api/README.md` §10.2): `page` 1-indexado y `limit` acotado a
// [1, 100]. `z.coerce` admite tanto el número que envía un cliente JSON como su
// forma en string, que es como llega en la query string de una URL.
export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;

export const paginationQuery = z.object({
  page: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(1, "Este campo es obligatorio")
    .default(1),
  limit: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(1, "Este campo es obligatorio")
    .max(PAGE_SIZE_MAX, `No puede ser mayor que ${PAGE_SIZE_MAX}`)
    .default(PAGE_SIZE_DEFAULT),
});

// Base de search params para cualquier listado administrativo: paginación más
// búsqueda libre. Cada recurso la extiende con sus filtros por columna (p. ej.
// `active`) y la usa tanto en el `validateSearch` de la ruta del panel como en
// el validador de la ruta del servidor.
export const listSearchQuery = paginationQuery.extend({
  search: searchTerm.optional(),
});

// Metadatos de paginación que devuelve el IS en todo listado.
export const pagination = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type Pagination = z.infer<typeof pagination>;
export type PaginationQuery = z.infer<typeof paginationQuery>;
export type ListSearchQuery = z.infer<typeof listSearchQuery>;
