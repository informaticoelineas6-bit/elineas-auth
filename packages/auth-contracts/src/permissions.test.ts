import { describe, expect, test } from "bun:test";
import {
  canManageAnySystem,
  canManageSystem,
  type ManagedSystem,
} from "./permissions.ts";

const pos: ManagedSystem = { id: "pos-id", slug: "pos", name: "POS" };

describe("administración delegada por sistema", () => {
  test("canManageAnySystem: superadmin o con al menos un sistema", () => {
    expect(canManageAnySystem({ isAdmin: true, managedSystems: [] })).toBe(true);
    expect(canManageAnySystem({ isAdmin: false, managedSystems: [pos] })).toBe(
      true,
    );
    expect(canManageAnySystem({ isAdmin: false, managedSystems: [] })).toBe(
      false,
    );
  });

  test("canManageSystem: el admin de sistema solo gestiona los suyos", () => {
    const ctx = { isAdmin: false, managedSystems: [pos] };
    expect(canManageSystem("pos-id", ctx)).toBe(true);
    expect(canManageSystem("otro-id", ctx)).toBe(false);
  });

  test("canManageSystem: el superadmin gestiona cualquiera", () => {
    expect(canManageSystem("lo-que-sea", { isAdmin: true, managedSystems: [] })).toBe(
      true,
    );
  });
});
