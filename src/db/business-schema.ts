import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user, session } from "@/db/auth-schema";

// Datos personales del empleado. Un empleado puede existir sin usuario
// (aún no se le ha creado cuenta) y un usuario puede no estar ligado a
// ningún empleado (cuentas de servicio/externas).
export const employee = pgTable(
  "employee",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    lastName: text("last_name").notNull(),
    ci: text("ci").notNull().unique(),
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
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    systemId: text("system_id")
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
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: text("role_id")
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
    sessionId: text("session_id")
      .primaryKey()
      .references(() => session.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    systemId: text("system_id")
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
