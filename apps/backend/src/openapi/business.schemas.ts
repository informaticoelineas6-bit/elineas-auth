import {
  address as Address,
  ci as Ci,
  companyEmail as CompanyEmail,
  description as Description,
  displayName as DisplayName,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  phoneNumber as PhoneNumber,
  searchTerm as SearchTerm,
  slug as Slug,
  url as Url,
  SORT_FIELDS,
  sortQuery,
} from "@elineas/auth-contracts";
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
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .openapi({
      param: { name: "page", in: "query", required: false },
      example: 1,
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAX)
    .default(PAGE_SIZE_DEFAULT)
    .openapi({
      param: { name: "limit", in: "query", required: false },
      example: PAGE_SIZE_DEFAULT,
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
    ci: z.string().nullable(),
    birthday: z.date().nullable(),
    phoneNumber: z.string().nullable(),
    address: z.string().nullable(),
    inDate: z.date().nullable(),
    outDate: z.date().nullable(),
    active: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
    // Departamentos: el listado y el detalle los incluyen; crear/actualizar no.
    departments: z
      .array(z.object({ id: z.uuid(), name: z.string(), isHead: z.boolean() }))
      .optional(),
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

// Fila del listado: parte de las cuentas, así que incluye usuarios SIN ficha de
// empleado (`hasProfile: false`). En esas filas `id` es el id del usuario (clave
// de fila) y no existe /employees/{id}.
export const EmployeeListItemSchema = EmployeeSchema.extend({
  hasProfile: z.boolean(),
  departments: z.array(
    z.object({ id: z.uuid(), name: z.string(), isHead: z.boolean() }),
  ),
}).openapi("EmployeeListItem");

export const CreateEmployeeBodySchema = z
  .object({
    userId: z.uuid().optional(),
    name: DisplayName.openapi({ example: "Ada" }),
    lastName: DisplayName.openapi({ example: "Lovelace" }),
    // 11 dígitos exactos, la misma regla que aplica el panel (`ci` en
    // @elineas/auth-contracts). El campo sigue siendo opcional: el panel omite
    // `ci` del payload cuando el usuario lo deja vacío (nunca envía ""), así
    // que un empleado sin CI se sigue dando de alta y editando igual.
    ci: Ci.optional().openapi({ example: "01010112345" }),
    birthday: z.coerce.date().optional(),
    phoneNumber: PhoneNumber.optional(),
    address: Address.optional(),
    inDate: z.coerce.date().optional(),
    outDate: z.coerce.date().optional(),
    active: z.boolean().optional(),
    // Reemplaza el conjunto de departamentos de la persona. `isHead` omitido:
    // jefe por defecto solo si es admin.
    departments: z
      .array(z.object({ departmentId: z.uuid(), isHead: z.boolean().optional() }))
      .max(50)
      .optional(),
  })
  .openapi("CreateEmployeeBody");

export const UpdateEmployeeBodySchema =
  CreateEmployeeBodySchema.partial().openapi("UpdateEmployeeBody");

export const EmployeeListQuerySchema = PaginationQuerySchema.extend({
  ...sortQuery(SORT_FIELDS.employees),
  // Solo personas que pertenecen a este departamento.
  departmentId: z
    .uuid()
    .optional()
    .openapi({ param: { name: "departmentId", in: "query", required: false } }),
  active: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "active", in: "query", required: false },
    }),
  // Búsqueda libre por nombre, apellido, CI o email del usuario enlazado
  // (coincidencia parcial, sin distinguir mayúsculas).
  search: SearchTerm.optional().openapi({
    param: { name: "search", in: "query", required: false },
    example: "Ada",
  }),
});

// ---------------------------------------------------------------------------
// Directorio de usuarios (solo lectura) para asignar roles desde la
// administración delegada: no expone nada más que lo necesario para elegir.
// ---------------------------------------------------------------------------
export const UserDirectoryQuerySchema = PaginationQuerySchema.extend({
  // Resolver un usuario concreto (p. ej. recuperar la etiqueta de uno ya elegido).
  userId: z
    .uuid()
    .optional()
    .openapi({ param: { name: "userId", in: "query", required: false } }),
  search: SearchTerm.optional().openapi({
    param: { name: "search", in: "query", required: false },
    example: "ada@",
  }),
});

export const UserDirectoryEntrySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    // false = tiene una ficha de empleado desactivada (no puede iniciar sesión).
    active: z.boolean(),
    employeeName: z.string().nullable(),
  })
  .openapi("UserDirectoryEntry");

// ---------------------------------------------------------------------------
// Usuarios de un sistema (administración delegada): quienes tienen al menos un
// rol en alguno de los sistemas que administra quien consulta.
// ---------------------------------------------------------------------------
export const ManagedUserListQuerySchema = PaginationQuerySchema.extend({
  search: SearchTerm.optional().openapi({
    param: { name: "search", in: "query", required: false },
  }),
  systemId: z
    .uuid()
    .optional()
    .openapi({ param: { name: "systemId", in: "query", required: false } }),
});

export const ManagedUserSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    // false = ficha de empleado desactivada (no puede iniciar sesión).
    active: z.boolean(),
    employee: z
      .object({
        id: z.uuid(),
        name: z.string(),
        lastName: z.string(),
        ci: z.string().nullable(),
        phoneNumber: z.string().nullable(),
        address: z.string().nullable(),
        active: z.boolean(),
      })
      .nullable(),
    // Solo los roles dentro de los sistemas que administra quien consulta.
    roles: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        system: z.object({ id: z.uuid(), slug: z.string(), name: z.string() }),
      }),
    ),
    // true si todos sus roles caen en sistemas administrados por quien consulta:
    // solo entonces se pueden editar sus datos y contraseña. Con roles en otros
    // sistemas (o siendo superadmin) la cuenta es compartida y solo se le
    // gestionan los roles de este sistema.
    editable: z.boolean(),
  })
  .openapi("ManagedUser");

export const UpdateManagedUserBodySchema = z
  .object({
    name: DisplayName.optional(),
    email: CompanyEmail.optional(),
    // Los departamentos no se delegan: solo con `departments:write`.
    employee: UpdateEmployeeBodySchema.omit({ userId: true, departments: true }).optional(),
  })
  .openapi("UpdateManagedUserBody");

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------
export const SystemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    url: z.string().nullable(),
    active: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("System");

export const CreateSystemBodySchema = z
  .object({
    name: DisplayName.openapi({ example: "Punto de Venta" }),
    slug: Slug.openapi({ example: "pos" }),
    description: Description.optional(),
    url: Url.optional().openapi({ example: "https://pos.mercadoelineas.com" }),
    active: z.boolean().optional(),
  })
  .openapi("CreateSystemBody");

export const UpdateSystemBodySchema =
  CreateSystemBodySchema.partial().openapi("UpdateSystemBody");

export const SystemListQuerySchema = PaginationQuerySchema.extend({
  ...sortQuery(SORT_FIELDS.systems),
  active: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "active", in: "query", required: false },
    }),
  // Búsqueda libre por nombre o slug (coincidencia parcial, sin distinguir
  // mayúsculas).
  search: SearchTerm.optional().openapi({
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
    systemId: z
      .uuid()
      .openapi({ example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c" }),
    name: DisplayName.openapi({ example: "admin" }),
    description: Description.optional(),
  })
  .openapi("CreateRoleBody");

export const UpdateRoleBodySchema = z
  .object({
    name: DisplayName.optional(),
    description: Description.optional(),
  })
  .openapi("UpdateRoleBody");

export const RoleListQuerySchema = PaginationQuerySchema.extend({
  ...sortQuery(SORT_FIELDS.roles),
  systemId: z
    .uuid()
    .optional()
    .openapi({
      param: { name: "systemId", in: "query", required: false },
    }),
  // Búsqueda libre por nombre del rol (coincidencia parcial, sin distinguir
  // mayúsculas).
  search: SearchTerm.optional().openapi({
    param: { name: "search", in: "query", required: false },
    example: "admin",
  }),
});

// ---------------------------------------------------------------------------
// Permission (catálogo) / RolePermission (asignación de permiso a rol)
// ---------------------------------------------------------------------------
export const PermissionSchema = z
  .object({
    id: z.uuid(),
    systemId: z.uuid(),
    resource: z.string().openapi({ example: "employees" }),
    action: z.string().openapi({ example: "read" }),
    description: z.string().nullable(),
    createdAt: z.date(),
  })
  .openapi("Permission");

// Filtro opcional del catálogo por sistema (el catálogo es por sistema).
export const PermissionListQuerySchema = z.object({
  systemId: z
    .uuid()
    .optional()
    .openapi({ param: { name: "systemId", in: "query" } }),
});

export const RolePermissionSchema = z
  .object({
    id: z.uuid(),
    resource: z.string().openapi({ example: "employees" }),
    action: z.string().openapi({ example: "read" }),
    description: z.string().nullable(),
  })
  .openapi("RolePermission");

export const MyPermissionSchema = z
  .object({
    resource: z.string().openapi({ example: "employees" }),
    action: z.string().openapi({ example: "read" }),
  })
  .openapi("MyPermission");

// Igual que MyUserRolesQuerySchema (mismo shape, propósito idéntico): sin
// `systemSlug`, GET /api/permissions/me resuelve los permisos del usuario en
// el sistema `auth`; con él, cualquier sistema consumidor pide los suyos.
export const MyPermissionsQuerySchema = z.object({
  systemSlug: z
    .string()
    .optional()
    .openapi({
      param: { name: "systemSlug", in: "query" },
    }),
});

export const SetRolePermissionsBodySchema = z
  .object({
    permissionIds: z
      .array(z.uuid())
      .openapi({ example: ["9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c"] }),
  })
  .openapi("SetRolePermissionsBody");

// Crea (o reutiliza si ya existe en el catálogo por resource+action) un
// permiso y lo asigna a `roleId`. `roleId` debe pertenecer a `systemId`: es
// la vía que usa el panel para "crear un permiso para un sistema", ya que
// `permission` en sí no tiene FK a `system` (ver comentario en
// business-schema.ts), y la relación real pasa por el rol.
export const AssignPermissionBodySchema = z
  .object({
    systemId: z
      .uuid()
      .openapi({ example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c" }),
    roleId: z
      .uuid()
      .openapi({ example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c" }),
    resource: z.string().min(1).openapi({ example: "employees" }),
    action: z.string().min(1).openapi({ example: "read" }),
    description: Description.optional(),
  })
  .openapi("AssignPermissionBody");

export const UpdatePermissionBodySchema = z
  .object({
    resource: z.string().min(1).optional(),
    action: z.string().min(1).optional(),
    description: Description.optional(),
  })
  .openapi("UpdatePermissionBody");

export const PermissionSystemParamSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
  systemId: z.uuid().openapi({ param: { name: "systemId", in: "path" } }),
});

export const PermissionRoleParamSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
  roleId: z.uuid().openapi({ param: { name: "roleId", in: "path" } }),
});

// Vista agrupada por sistema para el panel: cada sistema con los permisos
// (distintos por resource+action) que tiene asignados en cualquiera de sus
// roles, y en qué roles concretos de ESE sistema quedó cada uno.
export const SystemPermissionsSchema = z
  .object({
    system: SystemSchema,
    permissions: z.array(
      PermissionSchema.extend({
        roles: z.array(z.object({ id: z.uuid(), name: z.string() })),
      }),
    ),
  })
  .openapi("SystemPermissions");

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

// Asignación con usuario, rol y sistema ya resueltos (solo el listado de
// administración): el cliente no tiene que cruzar ids contra otros listados
// paginados, que dejaban ids "pelados" para lo que quedaba fuera de la página.
// `user` es null solo si la cuenta ya no existe.
export const UserRoleDetailSchema = UserRoleSchema.extend({
  user: z.object({ name: z.string(), email: z.string() }).nullable(),
  role: z.object({ name: z.string() }),
  system: z.object({ id: z.uuid(), name: z.string(), slug: z.string() }),
}).openapi("UserRoleDetail");

export const CreateUserRoleBodySchema = z
  .object({
    userId: z
      .uuid()
      .openapi({ example: "9f8a2b3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c" }),
    roleId: z
      .uuid()
      .openapi({ example: "3c1d2e4f-5a8b-4c0d-9e2f-3a4b5c6d7e8f" }),
  })
  .openapi("CreateUserRoleBody");

export const UserRoleListQuerySchema = PaginationQuerySchema.extend({
  ...sortQuery(SORT_FIELDS.userRoles),
  userId: z
    .uuid()
    .optional()
    .openapi({
      param: { name: "userId", in: "query", required: false },
    }),
  roleId: z
    .uuid()
    .optional()
    .openapi({
      param: { name: "roleId", in: "query", required: false },
    }),
  systemId: z
    .uuid()
    .optional()
    .openapi({
      param: { name: "systemId", in: "query", required: false },
    }),
});

// ---------------------------------------------------------------------------
// Session (listado administrativo, todas las sesiones de todos los usuarios)
// ---------------------------------------------------------------------------
export const SessionListQuerySchema = PaginationQuerySchema.extend({
  ...sortQuery(SORT_FIELDS.sessions),
  // Búsqueda libre por nombre o email del usuario dueño de la sesión
  // (coincidencia parcial, sin distinguir mayúsculas).
  search: SearchTerm.optional().openapi({
    param: { name: "search", in: "query", required: false },
    example: "Ada",
  }),
  // Sin indicar, se listan todas las sesiones (activas y expiradas). "true"
  // acota a las que aún no expiraron, "false" a las ya expiradas.
  active: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "active", in: "query", required: false },
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
  systemSlug: z
    .string()
    .optional()
    .openapi({
      param: { name: "systemSlug", in: "query" },
    }),
});

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------
export const DepartmentSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    active: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi("Department");

export const DepartmentListItemSchema = DepartmentSchema.extend({
  memberCount: z.number().int(),
}).openapi("DepartmentListItem");

export const CreateDepartmentBodySchema = z
  .object({
    name: DisplayName.openapi({ example: "Almacén central" }),
    description: Description.optional(),
    active: z.boolean().optional(),
  })
  .openapi("CreateDepartmentBody");

export const UpdateDepartmentBodySchema =
  CreateDepartmentBodySchema.partial().openapi("UpdateDepartmentBody");

// Alta múltiple: hasta 100 departamentos por petición.
export const BulkCreateDepartmentsBodySchema = z
  .object({
    departments: z.array(CreateDepartmentBodySchema).min(1).max(100),
  })
  .openapi("BulkCreateDepartmentsBody");

// Asignación múltiple de usuarios a un departamento.
export const AddDepartmentMembersBodySchema = z
  .object({
    userIds: z.array(z.uuid()).min(1).max(200),
    // Omitido: jefe solo quienes sean admin.
    isDepartmentHead: z.boolean().optional(),
  })
  .openapi("AddDepartmentMembersBody");

export const DepartmentListQuerySchema = PaginationQuerySchema.extend({
  ...sortQuery(SORT_FIELDS.departments),
  active: z
    .enum(["true", "false"])
    .optional()
    .openapi({ param: { name: "active", in: "query", required: false } }),
  search: SearchTerm.optional().openapi({
    param: { name: "search", in: "query", required: false },
  }),
});

export const BulkCreateDepartmentsResultSchema = z
  .object({
    created: z.array(DepartmentSchema),
    skipped: z.array(z.string()).openapi({
      description: "Nombres omitidos por estar repetidos o ya existir",
    }),
  })
  .openapi("BulkCreateDepartmentsResult");

export const DepartmentMemberSchema = z
  .object({
    employeeId: z.uuid(),
    userId: z.uuid().nullable(),
    name: z.string(),
    lastName: z.string(),
    email: z.string().nullable(),
    isHead: z.boolean(),
  })
  .openapi("DepartmentMember");

export const AddDepartmentMembersResultSchema = z
  .object({
    added: z.array(z.uuid()),
    skipped: z.array(z.uuid()).openapi({ description: "Ya eran miembros" }),
  })
  .openapi("AddDepartmentMembersResult");

export const DepartmentMemberParamSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
  employeeId: z.uuid().openapi({ param: { name: "employeeId", in: "path" } }),
});

export const SetDepartmentMemberHeadBodySchema = z
  .object({ isHead: z.boolean() })
  .openapi("SetDepartmentMemberHeadBody");
