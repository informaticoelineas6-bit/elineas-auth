import { z } from "@hono/zod-openapi";

// Parámetro de ruta reutilizable: /{id}
export const IdParamSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c",
  }),
});

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
    userId: z.string().optional(),
    name: z.string().min(1).openapi({ example: "Ada" }),
    lastName: z.string().min(1).openapi({ example: "Lovelace" }),
    ci: z.string().min(1).openapi({ example: "12345678" }),
    birthday: z.coerce.date().optional(),
    phoneNumber: z.string().optional(),
    address: z.string().optional(),
    inDate: z.coerce.date().optional(),
    outDate: z.coerce.date().optional(),
    active: z.boolean().optional(),
  })
  .openapi("CreateEmployeeBody");

export const UpdateEmployeeBodySchema = CreateEmployeeBodySchema.partial().openapi(
  "UpdateEmployeeBody",
);

export const EmployeeListQuerySchema = z.object({
  active: z.enum(["true", "false"]).optional().openapi({
    param: { name: "active", in: "query" },
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
    name: z.string().min(1).openapi({ example: "Punto de Venta" }),
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones")
      .openapi({ example: "pos" }),
    description: z.string().optional(),
    active: z.boolean().optional(),
  })
  .openapi("CreateSystemBody");

export const UpdateSystemBodySchema = CreateSystemBodySchema.partial().openapi(
  "UpdateSystemBody",
);

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
    systemId: z.string().openapi({ example: "sys_9f8a2b" }),
    name: z.string().min(1).openapi({ example: "admin" }),
    description: z.string().optional(),
  })
  .openapi("CreateRoleBody");

export const UpdateRoleBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .openapi("UpdateRoleBody");

export const RoleListQuerySchema = z.object({
  systemId: z.string().optional().openapi({
    param: { name: "systemId", in: "query" },
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
    userId: z.string().openapi({ example: "usr_9f8a2b" }),
    roleId: z.string().openapi({ example: "role_9f8a2b" }),
  })
  .openapi("CreateUserRoleBody");

export const UserRoleListQuerySchema = z.object({
  userId: z.string().optional().openapi({
    param: { name: "userId", in: "query" },
  }),
  roleId: z.string().optional().openapi({
    param: { name: "roleId", in: "query" },
  }),
});
