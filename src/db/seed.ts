// Seeder de arranque: crea el sistema y rol de administrador de este identity
// server y se lo asigna a un usuario ya existente (identificado por email).
//
// El usuario debe haberse registrado antes (POST /api/auth/sign-up), ya que la
// creación de cuentas la gestiona better-auth.
//
// Uso:
//   bun run db:seed:local -- admin@mercadoelineas.com
//   ADMIN_EMAIL=admin@mercadoelineas.com bun run db:seed:local
//
// Es idempotente: puede ejecutarse varias veces sin duplicar datos.
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { role, system, userRole } from "@/db/business-schema";
import { user } from "@/db/auth-schema";
import { env } from "@/config/env";

const email = process.argv[2] ?? process.env.ADMIN_EMAIL;

if (!email) {
  console.error(
    "Falta el email del administrador.\n" +
      "Uso: bun run db:seed:local -- admin@mercadoelineas.com\n" +
      "  o: ADMIN_EMAIL=admin@mercadoelineas.com bun run db:seed:local",
  );
  process.exit(1);
}

const [targetUser] = await db
  .select({ id: user.id, email: user.email })
  .from(user)
  .where(eq(user.email, email))
  .limit(1);

if (!targetUser) {
  console.error(
    `No existe ningún usuario con email "${email}".\n` +
      "Regístralo primero con POST /api/auth/sign-up y vuelve a ejecutar el seeder.",
  );
  process.exit(1);
}

// 1) Sistema que representa a este identity server.
await db
  .insert(system)
  .values({
    name: "Auth Server",
    slug: env.ADMIN_SYSTEM_SLUG,
    description: "Identity server (gestión de sistemas, roles y empleados)",
  })
  .onConflictDoNothing({ target: system.slug });

const [adminSystem] = await db
  .select()
  .from(system)
  .where(eq(system.slug, env.ADMIN_SYSTEM_SLUG))
  .limit(1);

// 2) Rol admin dentro de ese sistema.
await db
  .insert(role)
  .values({ systemId: adminSystem.id, name: env.ADMIN_ROLE_NAME })
  .onConflictDoNothing();

const [adminRole] = await db
  .select()
  .from(role)
  .where(and(eq(role.systemId, adminSystem.id), eq(role.name, env.ADMIN_ROLE_NAME)))
  .limit(1);

// 3) Asignación del rol admin al usuario.
await db
  .insert(userRole)
  .values({ userId: targetUser.id, roleId: adminRole.id })
  .onConflictDoNothing();

console.log("✔ Seed completado:");
console.log(`  sistema  ${adminSystem.slug} (${adminSystem.id})`);
console.log(`  rol      ${adminRole.name} (${adminRole.id})`);
console.log(`  usuario  ${targetUser.email} (${targetUser.id}) → admin`);

process.exit(0);
