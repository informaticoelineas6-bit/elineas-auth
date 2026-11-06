import { session, user } from "@backend/db/auth-schema.ts";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Igual que en auth-schema.ts: PKs uuid v4 con DEFAULT gen_random_uuid() en la
// propia BD (`defaultRandom()`), no `$defaultFn(() => crypto.randomUUID())`. La
// diferencia importa: `$defaultFn` solo se aplica cuando el INSERT pasa por
// drizzle, así que un INSERT manual o desde otra herramienta se quedaría sin id.

// Departamento de la organización. Una persona puede pertenecer a varios
// (tabla puente `employee_department`) y ser jefe de cada uno por separado.
export const department = pgTable("department", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Datos personales del empleado. Un empleado puede existir sin usuario
// (aún no se le ha creado cuenta) y un usuario puede no estar ligado a
// ningún empleado (cuentas de servicio/externas).
export const employee = pgTable(
  "employee",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    lastName: text("last_name").notNull(),
    ci: text("ci").unique(),
    birthday: timestamp("birthday"),
    phoneNumber: text("phone_number"),
    address: text("address"),
    inDate: timestamp("in_date"),
    outDate: timestamp("out_date"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("employee_userId_idx").on(table.userId)],
);

// Pertenencia empleado ↔ departamento (N:M). `isHead` marca al jefe de ESE
// departamento; por defecto lo son los admin (se decide en el servicio).
export const employeeDepartment = pgTable(
  "employee_department",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employee.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => department.id, { onDelete: "cascade" }),
    isHead: boolean("is_head").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("employeeDepartment_employeeId_idx").on(table.employeeId),
    index("employeeDepartment_departmentId_idx").on(table.departmentId),
    uniqueIndex("employeeDepartment_employeeId_departmentId_uidx").on(
      table.employeeId,
      table.departmentId,
    ),
  ],
);

// Un sistema es una aplicación/servicio de la organización sobre el cual
// se otorgan roles a los usuarios.
export const system = pgTable("system", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  url: text("url"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Clave de servicio de un sistema: sustituye al captcha en POST /api/auth/sign-in
// para clientes sin navegador (backends, Postman). Se guarda solo el hash
// SHA-256 (la clave es aleatoria de 256 bits, no hace falta un KDF lento). Va
// en tabla aparte para que ninguna consulta que devuelva filas de `system`
// pueda filtrarla por accidente.
export const systemServiceKey = pgTable("system_service_key", {
  systemId: uuid("system_id")
    .primaryKey()
    .references(() => system.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Los roles pertenecen a un sistema (no son globales): el mismo nombre de
// rol puede existir en distintos sistemas con significados independientes.
export const role = pgTable(
  "role",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("role_systemId_idx").on(table.systemId),
    uniqueIndex("role_systemId_name_uidx").on(table.systemId, table.name),
  ],
);

// Tabla puente: un usuario puede tener uno o más roles, y como cada rol
// pertenece a un sistema, esto cubre "uno o más roles por sistema" sin
// necesidad de una FK adicional a sistema en esta tabla.
export const userRole = pgTable(
  "user_role",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("userRole_userId_idx").on(table.userId),
    index("userRole_roleId_idx").on(table.roleId),
    uniqueIndex("userRole_userId_roleId_uidx").on(table.userId, table.roleId),
  ],
);

// Catálogo de permisos POR SISTEMA: cada fila es una capacidad puntual sobre
// un recurso ("employees", "orders", ...), expresada como acción concreta
// ("read"/"write"/"delete"), y pertenece a un `system`. Así el admin de un
// sistema gestiona su propio catálogo sin afectar a los demás. Los roles (que
// también pertenecen a un sistema) deciden, vía `role_permission`, qué
// permisos llevan; un rol solo puede llevar permisos de su propio sistema.
export const permission = pgTable(
  "permission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("permission_systemId_idx").on(table.systemId),
    uniqueIndex("permission_systemId_resource_action_uidx").on(
      table.systemId,
      table.resource,
      table.action,
    ),
  ],
);

// Tabla puente rol ↔ permiso: qué puede hacer cada rol. El rol admin del
// sistema `auth` (env.ADMIN_ROLE_NAME) no necesita filas aquí: se trata como
// comodín en `requirePermission` (ver middleware/permission.ts). Cualquier
// otro rol solo tiene las capacidades que se le asignen explícitamente aquí.
export const rolePermission = pgTable(
  "role_permission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permission.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("rolePermission_roleId_idx").on(table.roleId),
    index("rolePermission_permissionId_idx").on(table.permissionId),
    uniqueIndex("rolePermission_roleId_permissionId_uidx").on(
      table.roleId,
      table.permissionId,
    ),
  ],
);

// Cada sesión de login pertenece a exactamente un sistema: al ser un
// identity server, el usuario abre una sesión distinta por cada sistema
// al que accede (no una sesión SSO compartida entre todos). sessionId es
// la propia PK, lo que garantiza la relación 1 a 1 con `session`.
//
// userId está denormalizado desde `session.userId`: Postgres no puede
// validar un UNIQUE que cruce dos tablas, así que lo necesitamos aquí
// para poder exigir "una sola sesión por usuario y sistema".
export const sessionSystem = pgTable(
  "session_system",
  {
    // Sin defaultRandom a propósito: esta PK no es un id propio, es la FK a
    // `session.id` (relación 1 a 1). El valor lo aporta siempre quien inserta.
    sessionId: uuid("session_id")
      .primaryKey()
      .references(() => session.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    systemId: uuid("system_id")
      .notNull()
      .references(() => system.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sessionSystem_systemId_idx").on(table.systemId),
    uniqueIndex("sessionSystem_userId_systemId_uidx").on(
      table.userId,
      table.systemId,
    ),
  ],
);
