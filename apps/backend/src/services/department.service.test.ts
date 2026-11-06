import { describe, expect, test } from "bun:test";
import {
  partitionNewMembers,
  planBulkCreate,
  resolveIsHead,
  skippedNames,
} from "@backend/services/department.service.ts";

describe("alta múltiple de departamentos", () => {
  test("quita repetidos de la petición sin distinguir mayúsculas ni espacios", () => {
    const { toInsert, lookupKeys } = planBulkCreate(
      [{ name: "Ventas" }, { name: " ventas " }, { name: "VENTAS" }, { name: "RRHH" }],
      [],
    );
    expect(toInsert.map((d) => d.name)).toEqual(["Ventas", "RRHH"]);
    expect(lookupKeys).toEqual(["ventas", "rrhh"]);
  });

  test("omite los que ya existen (sin distinguir mayúsculas)", () => {
    const { toInsert } = planBulkCreate(
      [{ name: "Almacén" }, { name: "Compras" }],
      ["ALMACÉN"],
    );
    expect(toInsert.map((d) => d.name)).toEqual(["Compras"]);
  });

  test("conserva los demás campos del primero de cada nombre", () => {
    const { toInsert } = planBulkCreate(
      [
        { name: "A", description: "primero" },
        { name: "a", description: "segundo" },
      ],
      [],
    );
    expect(toInsert).toEqual([{ name: "A", description: "primero" }]);
  });

  test("skippedNames: devuelve los pedidos que no se crearon", () => {
    expect(skippedNames(["A", "a", "B", "C"], ["A", "C"])).toEqual(["a", "B"]);
    expect(skippedNames(["A"], ["A"])).toEqual([]);
  });
});

describe("jefe por defecto", () => {
  test("admin ⇒ jefe; no admin ⇒ no jefe", () => {
    expect(resolveIsHead(undefined, true)).toBe(true);
    expect(resolveIsHead(undefined, false)).toBe(false);
  });

  test("un valor explícito manda sobre la regla de admin", () => {
    expect(resolveIsHead(false, true)).toBe(false);
    expect(resolveIsHead(true, false)).toBe(true);
  });
});

describe("asignación múltiple de usuarios", () => {
  const byUser = new Map([
    ["u1", "e1"],
    ["u2", "e2"],
    ["u3", "e3"],
  ]);

  test("separa nuevos de los que ya eran miembros", () => {
    expect(partitionNewMembers(["u1", "u2", "u3"], byUser, new Set(["e2"]))).toEqual({
      added: ["u1", "u3"],
      skipped: ["u2"],
    });
  });

  test("un usuario sin ficha todavía (aún sin id de empleado) se agrega", () => {
    expect(partitionNewMembers(["u9"], byUser, new Set(["e1"]))).toEqual({
      added: ["u9"],
      skipped: [],
    });
  });

  test("nadie es miembro ⇒ todos se agregan", () => {
    expect(partitionNewMembers(["u1", "u2"], byUser, new Set())).toEqual({
      added: ["u1", "u2"],
      skipped: [],
    });
  });
});
