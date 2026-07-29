import { z } from "@hono/zod-openapi";

// Parámetro de ruta reutilizable: /{id}
// z.uuid() y no z.string(): todas las PKs son uuid, y un id mal formado que
// llegue a Postgres provoca un 500 (SQLSTATE 22P02 "invalid input syntax for
// type uuid") en lugar del 400/404 que corresponde. La validación lo corta antes.
export const IdParamSchema = z.object({
  id: z.uuid().openapi({
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
    id: z.uuid(),
    userId: z.uuid().nullable(),
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
    // Cuenta de usuario enlazada. Solo la embebe el listado (para mostrar/buscar
    // por email en una sola vista); las respuestas de un empleado individual la
    // omiten, por eso es opcional. `null` cuando el empleado no tiene usuario.
    user: z
      .object({
        id: z.uuid(),
        name: z.string(),
        email: z.string(),
      })
      .nullable()
      .optional(),
  })
  .openapi("Employee");

export const CreateEmployeeBodySchema = z
  .object({
    userId: z.uuid().optional(),
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
  // Búsqueda libre por nombre, apellido, CI o email del usuario enlazado
  // (coincidencia parcial, sin distinguir mayúsculas).
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
    id: z.uuid(),
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
    id: z.uuid(),
    systemId: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("Role");

export const CreateRoleBodySchema = z
  .object({
    systemId: z.uuid().openapi({ example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c" }),
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
  systemId: z.uuid().optional().openapi({
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
    id: z.uuid(),
    userId: z.uuid(),
    roleId: z.uuid(),
    createdAt: z.date(),
  })
  .openapi("UserRole");

export const CreateUserRoleBodySchema = z
  .object({
    userId: z.uuid().openapi({ example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c" }),
    roleId: z.uuid().openapi({ example: "3c1d2e4f-5a8b-4c0d-9e2f-3a4b5c6d7e8f" }),
  })
  .openapi("CreateUserRoleBody");

export const UserRoleListQuerySchema = PaginationQuerySchema.extend({
  userId: z.uuid().optional().openapi({
    param: { name: "userId", in: "query", required: false },
  }),
  roleId: z.uuid().optional().openapi({
    param: { name: "roleId", in: "query", required: false },
  }),
});

// ---------------------------------------------------------------------------
// Session (listado administrativo, todas las sesiones de todos los usuarios)
// ---------------------------------------------------------------------------
export const SessionListQuerySchema = PaginationQuerySchema.extend({
  // Búsqueda libre por nombre o email del usuario dueño de la sesión
  // (coincidencia parcial, sin distinguir mayúsculas).
  search: z.string().max(100).optional().openapi({
    param: { name: "search", in: "query", required: false },
    example: "Ada",
  }),
});

// Rol propio (vista de solo lectura para el usuario autenticado, no un admin):
// incluye el sistema al que pertenece el rol para que un cliente pueda filtrar
// por `systemSlug` sin exponer el resto de asignaciones de otros usuarios.
export const MyUserRoleSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    system: z.object({
      id: z.uuid(),
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
