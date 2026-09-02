import { z } from "zod";

// Primitivas de validación compartidas por el identity server y sus
// consumidores. Cada regla vive aquí UNA sola vez: antes estaban escritas dos
// veces (en `apps/api/src/openapi/*.schemas.ts` y en
// `apps/admin/src/modules/*/lib/validation.ts`) y habían divergido de verdad
// —la política de contraseña del panel era más estricta que la del servidor, y
// el login del panel rechazaba contraseñas que el servidor sí aceptaba—.
//
// Los mensajes están en español porque llegan al usuario tal cual: el panel los
// muestra bajo cada campo y el servidor los devuelve en el cuerpo del error.

// Dominio corporativo único admitido para cuentas del IS: el alta de usuarios
// no es autoservicio (la crea un admin), así que restringir el dominio evita
// cuentas con correos ajenos a la empresa. Se aplica al CREAR una cuenta o
// CAMBIAR el correo, nunca al iniciar sesión: una cuenta existente conserva el
// correo que tenga, aunque sea de un alta anterior a esta regla.
export const COMPANY_EMAIL_DOMAIN = "mercadoelineas.com";

export const companyEmail = z
  .email("Debe ser un correo electrónico válido")
  .refine((email) => email.toLowerCase().endsWith(`@${COMPANY_EMAIL_DOMAIN}`), {
    message: `El correo debe ser del dominio @${COMPANY_EMAIL_DOMAIN}`,
  });

// Correo sin restricción de dominio, para el login. Ver `signInPassword` para
// el porqué de la asimetría entre iniciar sesión y crear/cambiar.
export const loginEmail = z.email("Correo electrónico inválido");

// Política de contraseña NUEVA (alta de cuenta y cambio de contraseña). Debe
// mantenerse alineada con better-auth (`minPasswordLength`/`maxPasswordLength`
// en `apps/api/src/lib/auth.ts`), que aplica los límites de longitud por su
// cuenta pero no las clases de carácter.
//
// Las tres reglas de clase de carácter las exigía solo el panel: eso dejaba a
// la API aceptando contraseñas débiles cuando se la llamaba directamente. Al
// estar aquí, ambos extremos las aplican. Solo afecta a contraseñas nuevas, así
// que ninguna cuenta existente queda bloqueada.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const password = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `La contraseña no puede tener más de ${PASSWORD_MAX_LENGTH} caracteres`,
  )
  .refine((value) => /[A-Z]/.test(value), {
    message: "Debe contener al menos una letra mayúscula",
  })
  .refine((value) => /[a-z]/.test(value), {
    message: "Debe contener al menos una letra minúscula",
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: "Debe contener al menos un carácter especial",
  });

// Contraseña al INICIAR SESIÓN: deliberadamente permisiva. Aquí no se valida
// una política, solo que el campo no venga vacío, porque se comprueba contra el
// hash ya almacenado. Exigir la política de `password` en el login rechazaría
// contraseñas legítimas de cuentas creadas antes de endurecerla, dejando al
// usuario sin poder entrar (y sin poder cambiarla, porque para eso hay que
// entrar). El tope de longitud sí se mantiene, como cortafuegos de entrada.
export const signInPassword = z
  .string()
  .min(1, "Este campo es obligatorio")
  .max(
    PASSWORD_MAX_LENGTH,
    `La contraseña no puede tener más de ${PASSWORD_MAX_LENGTH} caracteres`,
  );

// Contraseña actual pedida como re-autenticación (cambio de contraseña o de
// correo). Es una contraseña YA existente, así que se valida como la de login.
export const currentPassword = z.string().min(1, "Este campo es obligatorio");

// Nombre visible de persona o entidad. Con tope de longitud para no aceptar
// cadenas arbitrariamente grandes que acaben renderizadas sin escapar en algún
// cliente consumidor.
export const displayName = z
  .string()
  .min(1, "Debe tener al menos 1 caracter")
  .max(100, "Debe tener menos de 100 caracteres");

// URL de imagen (avatar): acotada en longitud y restringida a http(s) para
// evitar almacenar un `javascript:`/`data:` que dispare XSS al renderizarse en
// un <img src=...> de cualquier frontend consumidor.
export const imageUrl = z
  .string()
  .max(2048, "Debe tener menos de 2048 caracteres")
  .regex(/^https?:\/\//i, "Debe ser una URL http(s)");

// Identificador legible de un sistema. El slug entra en URLs y en las claves de
// sesión por sistema, de ahí el juego de caracteres restringido.
export const slug = z
  .string()
  .min(1, "Este campo es obligatorio")
  .max(50, "Debe tener menos de 50 caracteres")
  .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones");

export const description = z
  .string()
  .max(500, "Debe tener menos de 500 caracteres");

// Texto libre de búsqueda de los listados administrativos.
export const searchTerm = z
  .string()
  .max(100, "Debe tener menos de 100 caracteres");

export const id = z.string().min(1, "Este campo es obligatorio");

// --- Campos de negocio (empleados) ------------------------------------------

// Carné de identidad: 11 dígitos exactos.
//
// OJO: esta regla la aplica hoy SOLO el panel. El servidor sigue aceptando
// `min(1).max(50)` a propósito, hasta comprobar que ninguna fila existente
// incumpla el formato; endurecerlo antes haría fallar con 400 la edición de
// empleados antiguos. Para comprobarlo:
//
//   SELECT id, ci FROM employee WHERE ci IS NOT NULL AND ci !~ '^[0-9]{11}$';
//
// Si no devuelve filas, sustituye `Ci` en `apps/api/src/openapi/business.schemas.ts`
// por esta primitiva y quedará aplicada en ambos extremos.
export const CI_LENGTH = 11;

export const ci = z
  .string()
  .regex(/^\d{11}$/, `El CI debe tener ${CI_LENGTH} dígitos`);

// Teléfono. Solo se acota la longitud: la validación de formato real por país
// (libphonenumber-js) se queda en el panel —`apps/admin/src/modules/common/lib/phone.ts`—
// porque la librería pesa ~275 KB y allí está aislada en su propio módulo para
// no arrastrarla al chunk compartido. Este paquete no debe depender de ella.
export const phoneNumber = z
  .string()
  .max(30, "Debe tener menos de 30 caracteres");

export const address = z
  .string()
  .max(300, "Debe tener menos de 300 caracteres");
