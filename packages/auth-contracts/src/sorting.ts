import { z } from "zod";

// Orden de los listados administrativos. Cada listado acepta `sortBy` (una de
// sus columnas ordenables, lista cerrada para que el cliente no pueda pedir
// orden por columnas arbitrarias) y `sortDir`. Sin `sortBy` el IS conserva el
// orden por defecto del recurso (más recientes primero).
export const sortDirection = z.enum(["asc", "desc"]);
export type SortDirection = z.infer<typeof sortDirection>;

export const SORT_FIELDS = {
  employees: [
    "name",
    "email",
    "ci",
    "phoneNumber",
    "inDate",
    "outDate",
    "active",
    "createdAt",
  ],
  departments: ["name", "description", "active", "members", "createdAt"],
  roles: ["name", "system", "description", "createdAt"],
  systems: ["name", "slug", "description", "active", "createdAt"],
  sessions: [
    "user",
    "device",
    "system",
    "ipAddress",
    "createdAt",
    "expiresAt",
    "status",
  ],
  userRoles: ["user", "role", "system", "createdAt"],
} as const;

// Forma de los params de orden para un listado concreto.
export function sortQuery<const T extends readonly [string, ...string[]]>(
  fields: T,
) {
  return {
    sortBy: z.enum(fields).optional(),
    sortDir: sortDirection.optional(),
  };
}
