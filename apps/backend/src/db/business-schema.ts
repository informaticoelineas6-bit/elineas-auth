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

// Catálogo global de permisos: cada fila es una capacidad puntual sobre un
// recurso de la API de este IS ("employees", "sessions", ...), expresada
// como acción concreta ("read"/"write"/"delete"). No pertenece a ningún
// `system`: es el mismo catálogo para toda la organización, y son los roles
// (que sí pertenecen a un sistema) los que deciden, vía `role_permission`,
// qué permisos llevan.
export const permission = pgTable(
  "permission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("permission_resource_action_uidx").on(
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

// Credenciales de TKC, un sistema EXTERNO al que la persona accede con un
// usuario/contraseña propios, distintos de los de este IS. El IS no autentica
// contra TKC: solo custodia esas credenciales y se las entrega a su dueño al
// iniciar sesión, para que el cliente pueda autenticarse allí sin volver a
// pedírselas.
//
// `username` es UNIQUE: identifica la cuenta en TKC, y el UNIQUE de
// `user_tkc_key.tkcKeyId` completa la regla de que no la compartan dos
// personas.
//
// `password` NO es un hash: se guarda CIFRADA (AES-256-GCM con clave de
// entorno, ver `src/lib/secret-box.ts`). Tiene que poder descifrarse, porque el
// sistema externo necesita la contraseña en claro; un hash sería irreversible y
// no serviría para nada aquí. El cifrado protege el caso realista: un volcado
// de la base de datos (backup, réplica, acceso de solo lectura) no entrega las
// credenciales de TKC de nadie, porque la clave no vive en la BD.
export const tkcKey = pgTable("tkc_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  // Texto cifrado, con el formato que produce `sealSecret` ("v1.iv.tag.ct").
  // Nunca se escribe ni se lee en claro fuera de src/lib/secret-box.ts.
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Tabla puente usuario ↔ credencial TKC. Es una tabla aparte y no un par de
// columnas en `user` porque el vínculo es OPCIONAL: la mayoría de usuarios no
// tiene credenciales TKC, y una fila ausente lo expresa mejor que dos columnas
// nulas en la tabla que más se consulta.
//
// La relación es UNO A UNO, con UNIQUE en las dos columnas:
//   - `userId`: un usuario tiene como mucho una credencial, que es lo que el
//     login puede devolver sin ambigüedad.
//   - `tkcKeyId`: una credencial pertenece como mucho a un usuario. Junto con
//     el UNIQUE de `tkc_key.username`, esto es lo que impide que dos personas
//     declaren la misma cuenta de TKC. La restricción vive en la BD y no solo
//     en el servicio: una carrera entre dos altas simultáneas con el mismo
//     usuario de TKC pasaría cualquier comprobación previa en la aplicación,
//     y aquí Postgres rechaza la segunda.
export const userTkcKey = pgTable("user_tkc_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  tkcKeyId: uuid("tkc_key_id")
    .notNull()
    .unique()
    .references(() => tkcKey.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
