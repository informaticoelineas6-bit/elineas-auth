// Seeder de arranque (bootstrap del primer admin): crea el sistema y rol de
// administrador de este identity server y se lo asigna a un usuario. Si el
// usuario no existe todavía, lo CREA (por eso el registro puede quedar cerrado
// a admin en la API: el primer admin nace aquí, no vía POST /api/auth/sign-up).
//
// Uso:
//   # usuario ya existente → solo asigna rol admin
//   bun run db:seed:local -- admin@example.com
//   # usuario nuevo → hay que pasar una contraseña (arg 2 o ADMIN_PASSWORD)
//   bun run db:seed:local -- admin@example.com 'tu-contraseña-segura'
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... bun run db:seed:local
//
// Es idempotente: puede ejecutarse varias veces sin duplicar datos.
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { role, system, userRole } from "@/db/business-schema";
import { user } from "@/db/auth-schema";
import { auth } from "@/lib/auth";
import { env } from "@/config/env";

const email = process.argv[2] ?? process.env.ADMIN_EMAIL;

if (!email) {
  console.error(
    "Falta el email del administrador.\n" +
      "Uso: bun run db:seed:local -- admin@example.com\n" +
      "  o: ADMIN_EMAIL=admin@example.com bun run db:seed:local",
  );
  process.exit(1);
}

async function findUser(byEmail: string) {
  const [row] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, byEmail))
    .limit(1);
  return row;
}

let targetUser = await findUser(email);

// Si el usuario no existe, lo creamos (bootstrap). La contraseña se pasa por
// argumento o por la variable ADMIN_PASSWORD y debe cumplir la política de
// longitud mínima configurada en lib/auth.ts.
if (!targetUser) {
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error(
      `No existe ningún usuario con email "${email}".\n` +
        "Para crearlo, indica una contraseña:\n" +
        "  bun run db:seed:local -- " +
        email +
        " 'tu-contraseña-segura'\n" +
        "  o define ADMIN_PASSWORD en el entorno.",
    );
    process.exit(1);
  }

  await auth.api.signUpEmail({
    body: { email, password, name: process.env.ADMIN_NAME ?? email },
  });

  targetUser = await findUser(email);
  if (!targetUser) {
    console.error("No se pudo crear el usuario administrador.");
    process.exit(1);
  }
  console.log(`✔ Usuario administrador creado: ${targetUser.email}`);
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
