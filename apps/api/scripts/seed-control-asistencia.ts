// Alta de las cuentas de prueba de `control-asistencia`.
//
// Script de un solo uso, idempotente: crea (si no existen) los usuarios, su
// empleado enlazado y sus asignaciones de rol en el sistema
// `control-asistencia`. No toca nada de otros sistemas.
//
//   APP_ENV=local bun --env-file=/dev/null scripts/seed-control-asistencia.ts
import { and, eq } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { employee, role, system, userRole } from "@/db/business-schema";
import { db } from "@/db/index";
import { auth } from "@/lib/auth";

const SYSTEM_SLUG = "control-asistencia";
const PASSWORD = "Asistencia2026!";

const ACCOUNTS = [
  {
    email: "ca.empleado@mercadoelineas.com",
    name: "Elena Prueba",
    employee: { name: "Elena", lastName: "Prueba", ci: "90000001" },
    roles: ["employee"],
  },
  {
    email: "ca.jefe@mercadoelineas.com",
    name: "Julio Prueba",
    employee: { name: "Julio", lastName: "Prueba", ci: "90000002" },
    roles: ["department_head"],
  },
  {
    email: "ca.gestor@mercadoelineas.com",
    name: "Gabriela Prueba",
    employee: { name: "Gabriela", lastName: "Prueba", ci: "90000003" },
    roles: ["global_manager"],
  },
  {
    email: "ca.super@mercadoelineas.com",
    name: "Sergio Prueba",
    employee: { name: "Sergio", lastName: "Prueba", ci: "90000004" },
    roles: ["superadmin"],
  },
  {
    // Dos roles a la vez: comprueba el rol efectivo (RN-03.1).
    email: "ca.multi@mercadoelineas.com",
    name: "Marta Prueba",
    employee: { name: "Marta", lastName: "Prueba", ci: "90000005" },
    roles: ["employee", "department_head"],
  },
  {
    // Sin rol: el IS debe rechazar su login con 403 (RN-00.33).
    email: "ca.sinrol@mercadoelineas.com",
    name: "Nadia Prueba",
    employee: { name: "Nadia", lastName: "Prueba", ci: "90000006" },
    roles: [],
  },
] as const;

const [targetSystem] = await db
  .select()
  .from(system)
  .where(eq(system.slug, SYSTEM_SLUG))
  .limit(1);

if (!targetSystem) {
  console.error(`No existe el sistema "${SYSTEM_SLUG}" en el IS.`);
  process.exit(1);
}

const roles = await db
  .select({ id: role.id, name: role.name })
  .from(role)
  .where(eq(role.systemId, targetSystem.id));

const roleByName = new Map(roles.map((r) => [r.name, r.id]));

for (const account of ACCOUNTS) {
  let [row] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, account.email))
    .limit(1);

  if (!row) {
    await auth.api.signUpEmail({
      body: { email: account.email, password: PASSWORD, name: account.name },
    });
    [row] = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, account.email))
      .limit(1);
    if (!row) {
      console.error(`No se pudo crear ${account.email}`);
      process.exit(1);
    }
    console.log(`✔ usuario creado   ${account.email}`);
  } else {
    console.log(`· usuario ya existe ${account.email}`);
  }

  await db
    .insert(employee)
    .values({ userId: row.id, ...account.employee })
    .onConflictDoNothing({ target: employee.userId });

  for (const roleName of account.roles) {
    const roleId = roleByName.get(roleName);
    if (!roleId) {
      console.error(`  ! el rol "${roleName}" no existe en ${SYSTEM_SLUG}`);
      continue;
    }
    await db
      .insert(userRole)
      .values({ userId: row.id, roleId })
      .onConflictDoNothing();
    console.log(`  → rol ${roleName}`);
  }

  if (account.roles.length === 0) {
    // Reejecución: si en una pasada anterior se le asignó algo, se quita, para
    // que esta cuenta siga sirviendo para probar el rechazo por falta de rol.
    for (const r of roles) {
      await db
        .delete(userRole)
        .where(and(eq(userRole.userId, row.id), eq(userRole.roleId, r.id)));
    }
    console.log("  → sin rol (a propósito)");
  }
}

console.log(`\nContraseña para todas las cuentas: ${PASSWORD}`);
process.exit(0);
