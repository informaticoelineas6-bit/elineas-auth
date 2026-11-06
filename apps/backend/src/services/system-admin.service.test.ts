import { describe, expect, test } from "bun:test";
import { HttpError } from "@backend/lib/http.ts";
import {
  assertCanManageSystem,
  canManage,
  isScopeEmpty,
  scopeFilter,
  type ManageScope,
} from "@backend/services/system-admin.service.ts";

const SUPER: ManageScope = { all: true };
const ADMIN_POS: ManageScope = { all: false, systemIds: ["pos"] };
const NONE: ManageScope = { all: false, systemIds: [] };

describe("alcance de administración", () => {
  test("isScopeEmpty: solo vacío sin sistemas y sin ser superadmin", () => {
    expect(isScopeEmpty(NONE)).toBe(true);
    expect(isScopeEmpty(ADMIN_POS)).toBe(false);
    expect(isScopeEmpty(SUPER)).toBe(false);
  });

  test("canManage: el superadmin gestiona todo; el admin solo lo suyo", () => {
    expect(canManage(SUPER, "cualquiera")).toBe(true);
    expect(canManage(ADMIN_POS, "pos")).toBe(true);
    expect(canManage(ADMIN_POS, "otro")).toBe(false);
    expect(canManage(NONE, "pos")).toBe(false);
  });

  test("assertCanManageSystem: 403 FORBIDDEN fuera del alcance", () => {
    expect(() => assertCanManageSystem(ADMIN_POS, "pos")).not.toThrow();
    try {
      assertCanManageSystem(ADMIN_POS, "otro");
      throw new Error("debía lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(403);
      expect((e as HttpError).code).toBe("FORBIDDEN");
    }
  });

  test("scopeFilter: sin sistema pedido acota al alcance (superadmin: sin límite)", () => {
    expect(scopeFilter(SUPER)).toBeUndefined();
    expect(scopeFilter(ADMIN_POS)).toEqual(["pos"]);
    expect(scopeFilter(NONE)).toEqual([]);
  });

  test("scopeFilter: con sistema pedido debe estar en el alcance", () => {
    expect(scopeFilter(SUPER, "x")).toEqual(["x"]);
    expect(scopeFilter(ADMIN_POS, "pos")).toEqual(["pos"]);
    expect(() => scopeFilter(ADMIN_POS, "otro")).toThrow(HttpError);
  });
});
