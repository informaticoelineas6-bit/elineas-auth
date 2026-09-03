// Parche puntual para un bug conocido y ya reportado aguas arriba
// (better-auth/better-auth#7691, duplicado de #6766: "Handle drizzle 1.0rc in
// drizzle-adapter") entre `@better-auth/drizzle-adapter@1.7.2` y las
// relaciones "Relations v2" de drizzle-orm (`defineRelations`, ver
// db/relations.ts). NO es un problema de datos ni de contraseña: ocurre
// ANTES de comprobar la contraseña, así que ningún usuario puede iniciar
// sesión mientras esté presente. Reproducido igual con el driver `pg`
// anterior a la migración a Bun.SQL, así que es independiente del driver.
//
// --- El bug ---
//
// Por defecto (sin `advanced.database.joins: true` en auth.ts) el adaptador
// ni siquiera intenta unir `user` con su `account` de credenciales: hace dos
// SELECT sueltos y el segundo no encuentra nada, así que el login falla
// siempre con "User not found" ANTES de comprobar la contraseña —
// independiente de si es correcta.
//
// Con `joins: true` (lo que hace falta para que `findUserByEmail(email, {
// includeAccounts: true })` — el que usa el login — funcione de verdad, según
// la propia documentación de better-auth) el adaptador SÍ intenta el join, vía
// `db.query[modelo].findFirst({ where: <condición>, with: {...} })` usando la
// API relacional (RQB) de drizzle. Pero construye esa `<condición>` con los
// builders "clásicos" de SQL (`eq`, `and`, `inArray`, ...) — el estilo que
// entendía la RQB v1 (`relations()`). La RQB v2 (`defineRelations`, la que usa
// este proyecto) espera en su lugar un objeto de filtro DECLARATIVO (p. ej.
// `{ email: { eq: '...' } }`). Al recibir una condición ya construida, la RQB
// v2 la trata como si fuera ese objeto de filtro e itera sus claves internas
// (`decoder`, `queryChunks`, ...) buscando nombres de columna o relación — y
// revienta con:
//
//   DrizzleError: Unknown relational filter field: "decoder"
//
// better-auth lo captura como un fallo genérico de "credenciales inválidas" y
// lo registra como `[Better Auth]: User not found`, así que en los logs es
// indistinguible de un usuario que realmente no existe.
//
// --- El arreglo ---
//
// La RQB v2 SÍ acepta una condición SQL ya construida a través de su vía de
// escape `RAW`, pero solo en su forma de FUNCIÓN —`{ RAW: (table, ops) =>
// ... }`—, porque en un JOIN necesita reconstruir la condición contra la
// tabla ALIASEADA que usa internamente (p. ej. "d0"), no contra la tabla
// original; pasar la condición ya construida directamente (`{ RAW: cond }`,
// sin función) sí evita el primer error pero genera SQL con un alias que no
// casa ("d0" vs "user"), y Postgres lo rechaza.
//
// `mapColumnsInSQLToAlias` (drizzle-orm/alias.js) es la propia utilidad
// interna que drizzle usa para resolver justo este caso — reescribe
// recursivamente cada referencia a columna dentro de un árbol SQL para que
// apunte a la tabla aliaseada, dejando el resto de la condición (operadores,
// AND/OR, parámetros) intacta. Al estar exportada públicamente desde
// "drizzle-orm", apoyarse en ella es bastante más robusto que parsear a mano
// los `queryChunks` de la condición.
//
// Este módulo envuelve `db.query` en un Proxy que, solo para `findFirst` y
// `findMany`, reescribe automáticamente cualquier `where` de tipo SQL a la
// forma `{ RAW: (table) => ... }` de arriba. El resto de `db` (select,
// insert, update, delete, transacciones) pasa sin tocar. NINGÚN código propio
// de esta app usa `db.query` (todo el resto usa `.select()/.insert()`), así
// que el shim solo afecta al adaptador de better-auth — es la única pieza que
// necesita esto. `joins: true` se activa junto con este shim en lib/auth.ts:
// uno sin el otro no arregla el login (sin joins:true nunca se llega a este
// código; sin el shim, con joins:true, revienta con el error de arriba).
//
// Quitar este archivo (y `joins: true` en lib/auth.ts) en cuanto
// `@better-auth/drizzle-adapter` publique un fix para Relations v2 — revisar
// el estado de https://github.com/better-auth/better-auth/issues/6766.

import { db } from "@backend/db/index.ts";
import { getTableName, is, mapColumnsInSQLToAlias, SQL } from "drizzle-orm";

// Reescribe `condition` para que sus referencias a columna apunten a
// `aliasedTable` (la tabla ya aliaseada que la RQB v2 pasa a las funciones
// `RAW`) en vez de a la tabla original con la que se construyó.
function rebaseOnAliasedTable(condition: SQL, aliasedTable: unknown): SQL {
  return mapColumnsInSQLToAlias(condition, getTableName(aliasedTable as never));
}

// Si `args.where` es una condición SQL ya construida (eq/and/or/...), la
// sustituye por la forma `{ RAW: fn }` que la RQB v2 sabe interpretar. Deja
// pasar sin tocar cualquier otra forma de `where` (undefined, o ya declarativa).
function patchWhere<T extends { where?: unknown }>(args: T): T {
  if (!args || !is(args.where, SQL)) return args;
  const originalWhere = args.where;
  return {
    ...args,
    where: {
      RAW: (table: unknown) => rebaseOnAliasedTable(originalWhere, table),
    },
  };
}

const PATCHED_METHODS = new Set(["findFirst", "findMany"]);

// NOTA sobre `receiver`: los tres `get` de abajo pasan `target` (el objeto
// real), NUNCA el proxy, como tercer argumento de `Reflect.get`. Si se deja
// el `receiver` por defecto (el propio proxy), cualquier getter interno de
// drizzle que use `this` — o un campo privado `#x` de clase — se ejecutaría
// con `this` apuntando al proxy en vez de al objeto real. Con `target` como
// receiver, esos getters ven el objeto real y funcionan igual que sin el
// proxy de por medio.
function wrapModelApi(modelApi: Record<string, unknown>) {
  return new Proxy(modelApi, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (
        typeof prop === "string" &&
        PATCHED_METHODS.has(prop) &&
        typeof value === "function"
      ) {
        return (args: Record<string, unknown>) =>
          value.call(target, patchWhere(args));
      }
      return value;
    },
  });
}

const queryProxy = new Proxy(
  db.query as unknown as Record<string, Record<string, unknown>>,
  {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (value && typeof value === "object")
        return wrapModelApi(value as Record<string, unknown>);
      return value;
    },
  },
);

// Instancia de `db` para el adaptador de better-auth ÚNICAMENTE: mismo
// cliente/relaciones que el `db` normal (db/index.ts), con `.query`
// interceptado por el parche de arriba. El resto de la app sigue usando `db`
// tal cual, sin pasar por este Proxy.
export const authDb = new Proxy(db, {
  get(target, prop) {
    if (prop === "query") return queryProxy;
    return Reflect.get(target, prop, target);
  },
});
