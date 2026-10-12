import { db } from "@backend/db/index.ts";
import { sql } from "drizzle-orm";

// Volcado SQL (esquema + datos) de la BD, generado en JavaScript sobre el
// catálogo de Postgres: no depende de `pg_dump` ni de nada instalado en la
// imagen. Se usa desde la ruta de administración POST /api/database/export.
//
// El resultado es un script restaurable (`psql -f`) y NO contiene secretos: ver
// EXCLUDED_DATA y REDACTED_COLUMNS. Es un volcado de consulta y respaldo
// funcional, no un sustituto de los backups de Postgres (no incluye roles,
// permisos de objetos, secuencias ni particiones).

const SCHEMA = "public";

// Tablas cuya ESTRUCTURA se exporta pero cuyas FILAS no, porque contienen
// secretos utilizables o datos efímeros/voluminosos (además, en cascada, las
// que tengan una FK hacia ellas: p. ej. session_system, ver más abajo):
//   - session: tokens de sesión vivos.
//   - verification: tokens de reset/verificación y códigos del login con Google.
//   - jwks: claves PRIVADAS con las que el IS firma los JWT.
//   - tkc_key / user_tkc_key: credenciales cifradas del sistema externo TKC.
//   - request_log: bitácora de peticiones (IPs, cuerpos), voluminosa y purgada
//     por retención.
const EXCLUDED_DATA = new Set([
  "session",
  "verification",
  "jwks",
  "tkc_key",
  "user_tkc_key",
  "request_log",
]);

// Columnas que se exportan siempre como NULL (hashes de contraseña y tokens de
// proveedores OAuth). Tras restaurar, los usuarios fijan su contraseña con el
// enlace de invitación (POST /api/users/admin/:id/invite).
const REDACTED_COLUMNS: Record<string, string[]> = {
  account: ["password", "access_token", "refresh_token", "id_token"],
};

// Filas por sentencia INSERT.
const BATCH_SIZE = 500;

const qi = (name: string) => `"${name.replaceAll('"', '""')}"`;
const qualified = (table: string) => `${qi(SCHEMA)}.${qi(table)}`;

type Row = Record<string, unknown>;

type Column = {
  name: string;
  type: string;
  notNull: boolean;
  identity: string;
  generated: string;
  default: string | null;
};

export type DatabaseDump = {
  filename: string;
  generatedAt: string;
  tables: number;
  sql: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export async function generateDatabaseDump(): Promise<DatabaseDump> {
  const now = new Date();
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;

  // Todo dentro de una transacción de SOLO LECTURA con snapshot REPEATABLE READ:
  // las tablas se leen en un mismo instante (sin filas de hoy que referencien a
  // otras de ayer) y el volcado no puede escribir nada aunque hubiera un bug.
  const script = await db.transaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );

    const all = async (query: ReturnType<typeof sql>) =>
      (await tx.execute(query)) as unknown as Row[];

    const tables = (
      await all(sql`
      select c.relname as name
      from pg_class c
      where c.relnamespace = ${SCHEMA}::regnamespace
        and c.relkind = 'r'
        and not c.relispartition
      order by c.relname
    `)
    ).map((r) => String(r.name));

    const columnRows = await all(sql`
      select c.relname as tbl, a.attname as name,
             format_type(a.atttypid, a.atttypmod) as type,
             a.attnotnull as not_null,
             a.attidentity as identity,
             a.attgenerated as generated,
             pg_get_expr(d.adbin, d.adrelid) as def
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where c.relnamespace = ${SCHEMA}::regnamespace
        and c.relkind = 'r'
        and a.attnum > 0
        and not a.attisdropped
      order by c.relname, a.attnum
    `);
    const columns = new Map<string, Column[]>();
    for (const r of columnRows) {
      const list = columns.get(String(r.tbl)) ?? [];
      list.push({
        name: String(r.name),
        type: String(r.type),
        notNull: r.not_null === true,
        identity: String(r.identity ?? ""),
        generated: String(r.generated ?? ""),
        default: r.def == null ? null : String(r.def),
      });
      columns.set(String(r.tbl), list);
    }

    const constraintRows = await all(sql`
      select cl.relname as tbl, con.conname as name, con.contype as type,
             (select relname from pg_class where oid = con.confrelid) as ref_tbl,
             pg_get_constraintdef(con.oid) as def
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      where con.connamespace = ${SCHEMA}::regnamespace
      order by cl.relname, con.conname
    `);

    // Una tabla con clave foránea hacia otra cuyas filas no se exportan no puede
    // restaurarse con sus filas (violaría la FK), así que sus datos también se
    // omiten, en cascada (p. ej. session_system depende de session).
    const excluded = new Set(EXCLUDED_DATA);
    for (let changed = true; changed; ) {
      changed = false;
      for (const con of constraintRows) {
        if (
          con.type === "f" &&
          excluded.has(String(con.ref_tbl)) &&
          !excluded.has(String(con.tbl))
        ) {
          excluded.add(String(con.tbl));
          changed = true;
        }
      }
    }

    const indexRows = await all(sql`
      select indexdef as def
      from pg_indexes
      where schemaname = ${SCHEMA}
        and indexname not in (
          select conname from pg_constraint
          where connamespace = ${SCHEMA}::regnamespace and contype in ('p', 'u', 'x')
        )
      order by tablename, indexname
    `);

    const extensionRows = await all(
      sql`select extname as name from pg_extension where extname <> 'plpgsql' order by extname`,
    );

    const enumRows = await all(sql`
      select t.typname as name,
             string_agg(e.enumlabel, chr(31) order by e.enumsortorder) as labels
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = ${SCHEMA}::regnamespace
      group by t.typname
      order by t.typname
    `);

    const out: string[] = [
      "-- Volcado de la base de datos de elineas-auth",
      `-- Generado: ${now.toISOString()}`,
      "-- Contiene esquema y datos. NO contiene secretos:",
      `--   * Sin filas de: ${[...excluded].sort().join(", ")}.`,
      ...Object.entries(REDACTED_COLUMNS).map(
        ([table, cols]) => `--   * ${table}: ${cols.join(", ")} van a NULL.`,
      ),
      "-- Tras restaurar, los usuarios deben fijar su contraseña con el enlace de invitación.",
      "",
      "BEGIN;",
      "",
    ];

    for (const ext of extensionRows) {
      out.push(`CREATE EXTENSION IF NOT EXISTS ${qi(String(ext.name))};`);
    }
    for (const e of enumRows) {
      const labels = String(e.labels)
        .split("\u001f")
        .map((label) => `'${label.replaceAll("'", "''")}'`)
        .join(", ");
      out.push(`CREATE TYPE ${qualified(String(e.name))} AS ENUM (${labels});`);
    }
    out.push("");

    // Esquema: las claves foráneas se añaden al final, tras cargar los datos,
    // para que el orden de las tablas no importe.
    const foreignKeys: string[] = [];
    for (const table of tables) {
      const lines: string[] = [];
      for (const col of columns.get(table) ?? []) {
        let line = `  ${qi(col.name)} ${col.type}`;
        if (col.identity === "a") line += " GENERATED ALWAYS AS IDENTITY";
        else if (col.identity === "d")
          line += " GENERATED BY DEFAULT AS IDENTITY";
        else if (col.generated === "s" && col.default) {
          line += ` GENERATED ALWAYS AS (${col.default}) STORED`;
        } else if (col.default) line += ` DEFAULT ${col.default}`;
        if (col.notNull) line += " NOT NULL";
        lines.push(line);
      }
      for (const con of constraintRows) {
        if (String(con.tbl) !== table) continue;
        if (con.type === "f") {
          foreignKeys.push(
            `ALTER TABLE ${qualified(table)} ADD CONSTRAINT ${qi(String(con.name))} ${String(con.def)};`,
          );
        } else {
          lines.push(`  CONSTRAINT ${qi(String(con.name))} ${String(con.def)}`);
        }
      }
      out.push(
        `CREATE TABLE ${qualified(table)} (`,
        lines.join(",\n"),
        ");",
        "",
      );
    }

    // Datos. Cada valor sale del servidor como literal SQL (quote_nullable sobre
    // el texto de la columna): Postgres lo reconvierte al tipo de la columna al
    // insertar, así que sirve para cualquier tipo (uuid, timestamp, jsonb, ...).
    for (const table of tables) {
      if (excluded.has(table)) continue;
      // Las columnas generadas no se insertan: las recalcula Postgres.
      const cols = (columns.get(table) ?? []).filter((c) => !c.generated);
      if (cols.length === 0) continue;
      const redacted = new Set(REDACTED_COLUMNS[table] ?? []);
      const select = cols
        .map((c) =>
          redacted.has(c.name)
            ? `'NULL' as ${qi(c.name)}`
            : `quote_nullable(${qi(c.name)}::text) as ${qi(c.name)}`,
        )
        .join(", ");
      const rows = await all(
        sql.raw(`select ${select} from ${qualified(table)} order by 1`),
      );
      const names = cols.map((c) => qi(c.name)).join(", ");
      const overriding = cols.some((c) => c.identity === "a")
        ? " OVERRIDING SYSTEM VALUE"
        : "";
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const values = rows
          .slice(i, i + BATCH_SIZE)
          .map(
            (row) => `  (${cols.map((c) => String(row[c.name])).join(", ")})`,
          )
          .join(",\n");
        out.push(
          `INSERT INTO ${qualified(table)} (${names})${overriding} VALUES`,
          `${values};`,
        );
      }
      if (rows.length > 0) out.push("");
    }

    for (const idx of indexRows) out.push(`${String(idx.def)};`);
    if (indexRows.length > 0) out.push("");
    out.push(...foreignKeys, "", "COMMIT;", "");
    return out.join("\n");
  });

  return {
    filename: `elineas-auth-${stamp}.sql`,
    generatedAt: now.toISOString(),
    tables: (script.match(/^CREATE TABLE /gm) ?? []).length,
    sql: script,
  };
}
