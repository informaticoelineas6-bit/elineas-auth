import { describe, expect, test } from "bun:test";
import {
  ci,
  companyEmail,
  currentPassword,
  loginEmail,
  password,
  signInPassword,
  slug,
} from "./primitives.ts";

// Estas pruebas fijan los cuatro puntos en los que el servidor y el panel
// habían divergido antes de existir este paquete. No son pruebas de zod: son el
// candado que impide que las reglas vuelvan a separarse sin que nadie se dé
// cuenta.

describe("password (contraseña nueva)", () => {
  test("acepta una que cumple longitud y las tres clases de carácter", () => {
    expect(password.safeParse("Contraseña-Segura1").success).toBe(true);
  });

  test("rechaza la que solo cumplía la regla vieja del servidor", () => {
    // 12 caracteres, pero sin mayúscula ni carácter especial: el servidor la
    // aceptaba y el panel no. Ahora la rechazan los dos.
    const result = password.safeParse("aaaaaaaaaaaa");
    expect(result.success).toBe(false);
  });

  test("exige mayúscula, minúscula y carácter especial por separado", () => {
    expect(password.safeParse("contraseña-larga1").success).toBe(false); // sin mayúscula
    expect(password.safeParse("CONTRASEÑA-LARGA1").success).toBe(false); // sin minúscula
    expect(password.safeParse("ContrasenaLarga1").success).toBe(false); // sin especial
  });

  test("respeta los límites de longitud", () => {
    expect(password.safeParse("Abc-defghij").success).toBe(false); // 11
    expect(password.safeParse(`Abc-${"d".repeat(124)}`).success).toBe(true); // 128
    expect(password.safeParse(`Abc-${"d".repeat(125)}`).success).toBe(false); // 129
  });
});

describe("signInPassword (login)", () => {
  test("acepta una contraseña corta de una cuenta antigua", () => {
    // El panel exigía 12 caracteres también al iniciar sesión, lo que dejaba
    // fuera a cuentas creadas antes de endurecer la política: no podían entrar
    // ni, por tanto, cambiarla. Al iniciar sesión solo se comprueba contra el
    // hash almacenado, así que aquí no se valida ninguna política.
    expect(signInPassword.safeParse("corta").success).toBe(true);
  });

  test("no acepta el campo vacío", () => {
    expect(signInPassword.safeParse("").success).toBe(false);
  });

  test("mantiene el tope de longitud como cortafuegos", () => {
    expect(signInPassword.safeParse("x".repeat(129)).success).toBe(false);
  });

  test("currentPassword se comporta igual: es una contraseña ya existente", () => {
    expect(currentPassword.safeParse("corta").success).toBe(true);
    expect(currentPassword.safeParse("").success).toBe(false);
  });
});

describe("companyEmail vs loginEmail", () => {
  test("crear cuenta exige el dominio corporativo", () => {
    expect(companyEmail.safeParse("ada@mercadoelineas.com").success).toBe(true);
    expect(companyEmail.safeParse("ada@gmail.com").success).toBe(false);
  });

  test("el dominio se compara sin distinguir mayúsculas", () => {
    expect(companyEmail.safeParse("Ada@MercadoElineas.com").success).toBe(true);
  });

  test("iniciar sesión NO exige el dominio", () => {
    // Una cuenta existente conserva el correo que tenga, aunque sea de un alta
    // anterior a la regla del dominio.
    expect(loginEmail.safeParse("ada@gmail.com").success).toBe(true);
    expect(loginEmail.safeParse("no-es-un-correo").success).toBe(false);
  });
});

describe("ci", () => {
  test("exige 11 dígitos exactos", () => {
    expect(ci.safeParse("01234567890").success).toBe(true);
    expect(ci.safeParse("1234567890").success).toBe(false); // 10
    expect(ci.safeParse("012345678901").success).toBe(false); // 12
    expect(ci.safeParse("0123456789a").success).toBe(false); // no dígito
  });

  test("opcional deja pasar la ausencia, pero no la cadena vacía", () => {
    // Así se usa en las rutas del servidor (`ci: Ci.optional()`): hay empleados
    // sin CI, y el panel omite el campo del payload cuando se deja en blanco en
    // vez de enviar "". Si alguna vez enviara "", tiene que fallar de forma
    // visible y no colarse como un CI vacío en la BD, donde además chocaría con
    // la restricción UNIQUE de la columna.
    const optional = ci.optional();
    expect(optional.safeParse(undefined).success).toBe(true);
    expect(optional.safeParse("01010112345").success).toBe(true);
    expect(optional.safeParse("").success).toBe(false);
  });
});

describe("slug", () => {
  test("solo minúsculas, números y guiones", () => {
    expect(slug.safeParse("punto-de-venta").success).toBe(true);
    expect(slug.safeParse("Punto-De-Venta").success).toBe(false);
    expect(slug.safeParse("punto_de_venta").success).toBe(false);
  });
});
