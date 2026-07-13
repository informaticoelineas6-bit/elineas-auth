import { z } from "@hono/zod-openapi";

// Parámetro de ruta reutilizable: /{id}
export const IdParamSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c",
  }),
});

// ---------------------------------------------------------------------------
// Paginación (compartida por todos los listados)
// ---------------------------------------------------------------------------
// Query reutilizable: `page` 1-indexado y `limit` acotado a [1, 100] para que
// un cliente no pueda pedir toda la tabla de una vez. z.coerce convierte el
// string del query a número; los valores por defecto se aplican si se omiten.
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({
    param: { name: "page", in: "query", required: false },
    example: 1,
  }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    param: { name: "limit", in: "query", required: false },
    example: 20,
  }),
});

// Metadatos que acompañan a cada respuesta de listado.
export const PaginationSchema = z
  .object({
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 20 }),
    total: z.number().int().openapi({ example: 57 }),
    totalPages: z.number().int().openapi({ example: 3 }),
  })
  .openapi("Pagination");

// ---------------------------------------------------------------------------
// Employee
// ---------------------------------------------------------------------------
export const EmployeeSchema = z
  .object({
    id: z.string(),
    userId: z.string().nullable(),
    name: z.string(),
    lastName: z.string(),
    ci: z.string(),
    birthday: z.date().nullable(),
    phoneNumber: z.string().nullable(),
    address: z.string().nullable(),
    inDate: z.date().nullable(),
    outDate: z.date().nullable(),
    active: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("Employee");

export const CreateEmployeeBodySchema = z
  .object({
    userId: z.string().max(100).optional(),
    name: z.string().min(1).max(100).openapi({ example: "Ada" }),
    lastName: z.string().min(1).max(100).openapi({ example: "Lovelace" }),
    ci: z.string().min(1).max(50).openapi({ example: "12345678" }),
    birthday: z.coerce.date().optional(),
    phoneNumber: z.string().max(30).optional(),
    address: z.string().max(300).optional(),
    inDate: z.coerce.date().optional(),
    outDate: z.coerce.date().optional(),
    active: z.boolean().optional(),
  })
  .openapi("CreateEmployeeBody");

export const UpdateEmployeeBodySchema = CreateEmployeeBodySchema.partial().openapi(
  "UpdateEmployeeBody",
);

export const EmployeeListQuerySchema = PaginationQuerySchema.extend({
  active: z.enum(["true", "false"]).optional().openapi({
    param: { name: "active", in: "query", required: false },
  }),
  // Búsqueda libre por nombre, apellido o CI (coincidencia parcial, sin
  // distinguir mayúsculas).
  search: z.string().max(100).optional().openapi({
    param: { name: "search", in: "query", required: false },
    example: "Ada",
  }),
});

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------
export const SystemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    active: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("System");

export const CreateSystemBodySchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ example: "Punto de Venta" }),
    slug: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones")
      .openapi({ example: "pos" }),
    description: z.string().max(500).optional(),
    active: z.boolean().optional(),
  })
  .openapi("CreateSystemBody");

export const UpdateSystemBodySchema = CreateSystemBodySchema.partial().openapi(
  "UpdateSystemBody",
);

export const SystemListQuerySchema = PaginationQuerySchema.extend({
  active: z.enum(["true", "false"]).optional().openapi({
    param: { name: "active", in: "query", required: false },
  }),
  // Búsqueda libre por nombre o slug (coincidencia parcial, sin distinguir
  // mayúsculas).
  search: z.string().max(100).optional().openapi({
    param: { name: "search", in: "query", required: false },
    example: "pos",
  }),
});

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------
export const RoleSchema = z
  .object({
    id: z.string(),
    systemId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("Role");

export const CreateRoleBodySchema = z
  .object({
    systemId: z.string().max(100).openapi({ example: "sys_9f8a2b" }),
    name: z.string().min(1).max(100).openapi({ example: "admin" }),
    description: z.string().max(500).optional(),
  })
  .openapi("CreateRoleBody");

export const UpdateRoleBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
  })
  .openapi("UpdateRoleBody");

export const RoleListQuerySchema = PaginationQuerySchema.extend({
  systemId: z.string().optional().openapi({
    param: { name: "systemId", in: "query", required: false },
  }),
  // Búsqueda libre por nombre del rol (coincidencia parcial, sin distinguir
  // mayúsculas).
  search: z.string().max(100).optional().openapi({
    param: { name: "search", in: "query", required: false },
    example: "admin",
  }),
});

// ---------------------------------------------------------------------------
// UserRole (asignación de rol a usuario)
// ---------------------------------------------------------------------------
export const UserRoleSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    roleId: z.string(),
    createdAt: z.date(),
  })
  .openapi("UserRole");

export const CreateUserRoleBodySchema = z
  .object({
    userId: z.string().min(1).max(100).openapi({ example: "usr_9f8a2b" }),
    roleId: z.string().min(1).max(100).openapi({ example: "role_9f8a2b" }),
  })
  .openapi("CreateUserRoleBody");

export const UserRoleListQuerySchema = PaginationQuerySchema.extend({
  userId: z.string().optional().openapi({
    param: { name: "userId", in: "query", required: false },
  }),
  roleId: z.string().optional().openapi({
    param: { name: "roleId", in: "query", required: false },
  }),
});

// Rol propio (vista de solo lectura para el usuario autenticado, no un admin):
// incluye el sistema al que pertenece el rol para que un cliente pueda filtrar
// por `systemSlug` sin exponer el resto de asignaciones de otros usuarios.
export const MyUserRoleSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    system: z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
    }),
  })
  .openapi("MyUserRole");

export const MyUserRolesQuerySchema = z.object({
  systemSlug: z.string().optional().openapi({
    param: { name: "systemSlug", in: "query" },
  }),
});
