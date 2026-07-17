postgres://postgres:mgkTxZAQPfYXY9Ni4x9nAmgMVIVa1e0jDs0YdkMNwIH7yxWF3fYkKXqhi0WexRmH@bkmvpswwmipwxpyngmt8zhlv:5432/auth
redis://default:we8QgzsFfajf4X1xlzaO9ePtPMw09jcjp4mWq8CulRz7UrAgE0PQAjiZdm8LBlsv@y3wa4fiax9ra9rrdubp9l2tm:6379/0

# Guía de integración con el Identity Server (Elineas Auth)

Esta guía explica cómo otras APIs (backends) y frontends de la organización deben
integrarse con este Identity Server (en adelante **IS**) para autenticar y
autorizar usuarios de forma segura. Está basada en el comportamiento real
implementado en este repositorio (Hono + better-auth + Drizzle + Redis).

Este repositorio contiene **únicamente la API** (`@elineas/auth`). Cualquier
frontend/backend consumidor vive en su propio repositorio e integra contra
este IS por red, siguiendo esta guía.

## 0. Cómo levantar la API

### Requisitos de configuración

Copia `.env.example` a `.env.local` y rellena los secretos. `ALLOWED_ORIGIN`
**debe** incluir el/los orígenes de los frontends/backends que consumirán
este IS (lista separada por comas si son varios).

### A) Local (sin Docker, con Bun)

Necesitas Postgres y Redis accesibles (o levántalos con
`docker compose up -d postgres redis`):

```bash
bun install
bun run dev
```

La API queda disponible en [http://localhost:8080](http://localhost:8080).

Para probar el envío de correos en local, levanta también maildev
(`docker compose up -d maildev`) y define `SMTP_HOST=localhost` en
`.env.local`; los correos capturados se ven en
[http://localhost:8025](http://localhost:8025). Ver las variables de correo
(`RESEND_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM`) en `.env.example`:
en producción se usa Resend con `RESEND_API_KEY` y sin ellas el mailer queda
deshabilitado.

### B) Docker — desarrollo (hot reload)

`docker-compose.yml` define `postgres`, `redis`, `maildev` y `api`, con las
credenciales locales ya resueltas (no requiere secretos de infraestructura
para levantarse):

```bash
docker compose up --build
```

- API: [http://localhost:8080](http://localhost:8080)
- Correos capturados por maildev: [http://localhost:8025](http://localhost:8025)
- El código fuente está montado como bind mount, así que los cambios recargan
  en caliente (`bun --watch`).

### C) Docker — producción

`docker-compose.prod.yml` construye la imagen optimizada (bundle de Bun) y
requiere los secretos de infraestructura como variables de entorno:

```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 32)
export REDIS_PASSWORD=$(openssl rand -hex 32)

docker compose -f docker-compose.prod.yml up -d --build
```

> En **Coolify**, en cambio, no usarás `docker-compose.prod.yml` directamente:
> cada recurso (Postgres, Redis, API) se crea por separado en la UI y las
> variables de entorno (`DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`,
> `ALLOWED_ORIGIN`, etc.) se configuran ahí, como recursos/variables de
> Coolify — no desde archivos `.env` del repo. Ver la guía dedicada:
> **[docs/coolify-deployment.md](docs/coolify-deployment.md)**.

## 1. Modelo mental

El IS es un servidor de identidad **multi-sistema**:

- Cada aplicación de la organización (un backend, un frontend, un POS, etc.) se
  registra como un **sistema** (`system`, con un `slug` único, p. ej. `pos`,
  `ecommerce`, `backoffice`).
- Cada inicio de sesión pertenece a **un sistema concreto**: no existe SSO
  compartido entre todos los sistemas. Un mismo usuario puede tener una sesión
  activa por sistema (`src/db/business-schema.ts:112` — `sessionSystem`, único
  por `userId + systemId`).
- Los **roles** (`role`) pertenecen a un sistema, no son globales
  (`src/db/business-schema.ts:60-77`).
- El IS resuelve **quién** es el usuario (autenticación). **Qué puede hacer**
  ese usuario dentro de tu sistema (autorización fina) es responsabilidad de
  cada sistema consumidor — ver [sección 7](#7-autenticación-vs-autorización-qué-hace-el-is-y-qué-no).

```
┌────────────┐   1. sign-in (systemSlug)   ┌──────────────────────┐
│  Frontend  │ ───────────────────────────▶│   Identity Server    │
│  (React)   │◀─────────────────────────── │  (este repo)         │
└────────────┘   cookie de sesión + JWT     └──────────┬───────────┘
      │                                                 │
      │ 2. Authorization: Bearer <JWT>                  │ JWKS público
      ▼                                                 ▼
┌────────────┐                              ┌──────────────────────┐
│  Tu API    │──── 3. verifica el JWT ─────▶│  /api/auth/jwks       │
│ (Node.js)  │       localmente (sin red)    └──────────────────────┘
└────────────┘
```

## 2. Conceptos clave de autenticación

El IS usa [better-auth](https://www.better-auth.com/) (`src/lib/auth.ts:8-24`)
con los plugins `jwt()` y `bearer()`. Esto da **dos credenciales** por sesión:

1. **Cookie de sesión** (`Set-Cookie`, httpOnly): la usa el propio navegador
   cuando habla directamente con el IS. Útil para un frontend que solo
   necesita saber "¿quién soy?" (`GET /api/sessions/session`) sin backend
   propio.
2. **JWT firmado** (campo `token` en la respuesta y cabecera `Set-Auth-Jwt`):
   pensado para que **tu backend** lo verifique de forma **stateless**, sin
   llamar al IS en cada request. Es de corta duración — tu frontend debe
   renovarlo con `GET /api/auth/token` cuando expire.

**Regla práctica:**

- Frontend ↔ IS: cookie (o el JWT si el frontend llama directamente a `/api/sessions/session`).
- Frontend ↔ tu backend: cabecera `Authorization: Bearer <JWT>`.
- Tu backend ↔ IS: nunca reenvíes credenciales de usuario salvo que necesites
  datos de sesión autoritativos; para la validación normal, verifica el JWT
  localmente contra el JWKS.

## 3. Alta de un nuevo sistema consumidor

Antes de que un frontend/API nuevo pueda usar el IS, un administrador del IS
(rol `admin` en el sistema `auth`, ver `ADMIN_SYSTEM_SLUG`/`ADMIN_ROLE_NAME` en
`.env.example`) debe:

1. **Registrar el origen en CORS** — añadir el dominio del frontend a
   `ALLOWED_ORIGIN` en el entorno del IS (lista separada por comas,
   `src/config/env.ts:29-38`). Sin esto, el navegador bloquea toda petición
   cross-origin, incluida la de login.
2. **Crear el** `system` correspondiente:

```bash
 curl -X POST https://auth.mercadoelineas.com/api/systems \
   -H "Authorization: Bearer $ADMIN_JWT" \
   -H "Content-Type: application/json" \
   -d '{"name":"Punto de Venta","slug":"pos","description":"POS de tiendas"}'
```

1. **Crear los roles de ese sistema** (opcional, si tu app hace su propia
   gestión de permisos vía IS):
2. **Asignar el rol a usuarios** vía `POST /api/user-roles`.

Todos estos endpoints (`/api/systems`, `/api/roles`, `/api/user-roles`,
`/api/employees`) exigen sesión **y** rol `admin` en el sistema `auth`
(`requireAdmin`, `src/middleware/admin.ts:11-36`). Son para gestión
administrativa centralizada, no para que cada backend los consulte por
petición — ver sección 7.

## 4. Integración desde un frontend (React)

### 4.1 Cliente de autenticación

```ts
// src/lib/identityClient.ts
const IDENTITY_SERVER_URL = import.meta.env.VITE_IDENTITY_SERVER_URL; // p.ej. https://auth.mercadoelineas.com
const SYSTEM_SLUG = "pos"; // el slug registrado para esta app

type AuthResult = {
  user: { id: string; name: string; email: string; emailVerified: boolean };
  token: string | null;
  system: { id: string; slug: string; name: string } | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${IDENTITY_SERVER_URL}${path}`, {
    ...init,
    credentials: "include", // imprescindible: envía/recibe la cookie de sesión
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "5");
    throw new Error(`RATE_LIMITED:${retryAfter}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.code ?? body.error ?? `HTTP_${res.status}`);
  }
  return res.json();
}

export const identityClient = {
  signIn: (email: string, password: string) =>
    request<AuthResult>("/api/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({ email, password, systemSlug: SYSTEM_SLUG }),
    }),

  signOut: () =>
    request<{ success: boolean }>("/api/auth/sign-out", { method: "POST" }),

  getSession: () =>
    request<{
      user: AuthResult["user"];
      session: unknown;
      system: AuthResult["system"];
    }>("/api/sessions/session"),

  // Renueva el JWT usando la cookie de sesión (o el JWT aún vigente) vigente.
  refreshToken: () => request<{ token: string | null }>("/api/auth/token"),
};
```

> El `systemSlug` es obligatorio en `sign-in` (`SignInBodySchema`,
> `src/openapi/schemas.ts:17-26`). El alta de usuarios (`sign-up`) **no** es
> autoservicio: requiere que quien llama ya sea admin (`src/routes/auth.routes.ts:27-52`),
> así que un frontend normal nunca debe exponer un formulario de registro
> público contra este IS — los usuarios los crea un admin o el seed inicial.

### 4.2 `AuthContext` con JWT en memoria (no en `localStorage`)

Guardar el JWT en `localStorage` lo expone a robo vía XSS. Guárdalo solo en
memoria (estado de React) y renuévalo bajo demanda; la sesión "persistente"
la garantiza la cookie httpOnly, no el JWT.

```tsx
// src/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import { identityClient } from "@/lib/identityClient";

type AuthState = {
  user: { id: string; name: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<{ value: string | null; expiresAt: number }>({
    value: null,
    expiresAt: 0,
  });

  useEffect(() => {
    identityClient
      .getSession()
      .then((s) => setUser(s.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await identityClient.signIn(email, password);
    setUser(result.user);
    // Cachea el JWT emitido en el propio login; evita una llamada extra.
    tokenRef.current = {
      value: result.token,
      expiresAt: Date.now() + 10 * 60_000,
    };
  }, []);

  const signOut = useCallback(async () => {
    await identityClient.signOut();
    setUser(null);
    tokenRef.current = { value: null, expiresAt: 0 };
  }, []);

  // Los backends deben validar el JWT ellos mismos; aquí solo garantizamos
  // no enviar un token ya vencido "a ciegas".
  const getAccessToken = useCallback(async () => {
    if (tokenRef.current.value && Date.now() < tokenRef.current.expiresAt) {
      return tokenRef.current.value;
    }
    const { token } = await identityClient.refreshToken();
    tokenRef.current = { value: token, expiresAt: Date.now() + 10 * 60_000 };
    return token;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signOut, getAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
```

### 4.3 Llamar a **tu** API (no al IS) con el JWT

```ts
// src/lib/apiClient.ts
import { useAuth } from "@/auth/AuthContext";

export function useApi() {
  const { getAccessToken, signOut } = useAuth();

  return useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getAccessToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });
      if (res.status === 401) {
        // El backend rechazó el token (expirado/inválido): cierra sesión local.
        await signOut();
      }
      return res;
    },
    [getAccessToken, signOut],
  );
}
```

### 4.4 Formulario de login mínimo

```tsx
// src/auth/LoginForm.tsx
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";

export function LoginForm() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    try {
      await signIn(String(form.get("email")), String(form.get("password")));
    } catch (err) {
      const message = String(err);
      setError(
        message.startsWith("RATE_LIMITED")
          ? "Demasiados intentos. Espera unos segundos e inténtalo de nuevo."
          : "Credenciales inválidas.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" autoComplete="username" required />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <button type="submit" disabled={submitting}>
        Entrar
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

## 5. Integración desde un backend (Node.js)

Tu API **nunca** debe reenviar la contraseña del usuario al IS por request ni
guardar credenciales de terceros. Debe validar el `Authorization: Bearer <JWT>` que le envía el frontend.

### 5.1 Middleware de verificación (JWKS, sin llamada al IS por request)

```ts
// src/middleware/verifyIdentity.ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Request, Response, NextFunction } from "express";

const IDENTITY_SERVER_URL = process.env.IDENTITY_SERVER_URL!; // https://auth.mercadoelineas.com

// createRemoteJWKSet cachea las claves públicas y las refresca solo cuando
// aparece un `kid` desconocido (rotación de claves) — no golpea al IS en
// cada request.
const JWKS = createRemoteJWKSet(new URL("/api/auth/jwks", IDENTITY_SERVER_URL));

export interface AuthenticatedRequest extends Request {
  identity?: JWTPayload & { email?: string; name?: string };
}

export async function requireIdentity(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "No autorizado", code: "UNAUTHORIZED" });
  }

  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      issuer: IDENTITY_SERVER_URL,
    });
    req.identity = payload; // payload.sub = id del usuario en el IS
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "Token inválido o expirado", code: "UNAUTHORIZED" });
  }
}
```

```ts
// src/app.ts
import express from "express";
import { requireIdentity } from "@/middleware/verifyIdentity";

const app = express();
app.use(express.json());

app.get("/api/orders", requireIdentity, (req, res) => {
  const userId = req.identity!.sub; // id del usuario, estable entre sistemas
  // ... tu lógica de negocio y AUTORIZACIÓN propia, ver sección 7
  res.json({ orders: [] });
});
```

### 5.2 Alternativa: validación autoritativa (revocación inmediata)

La verificación local por JWKS es rápida pero, si el usuario cierra sesión o
un admin revoca su sesión, el JWT sigue siendo válido hasta que expira (es
corta la ventana, pero existe). Si tu operación es sensible (p. ej. cambios
de dinero) y necesitas que una revocación surta efecto al instante, valida
contra el IS en su lugar:

```ts
async function verifyAgainstIdentityServer(bearerToken: string) {
  const res = await fetch(`${IDENTITY_SERVER_URL}/api/sessions/session`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) return null;
  return res.json(); // { user, session, system }
}
```

Esto añade una llamada de red por request — úsalo solo donde de verdad lo
necesites, no como middleware global.

## 6. CORS

El IS refleja el `Origin` solo si está en `ALLOWED_ORIGIN`
(`src/app.ts:34-48`). Si tu frontend recibe errores de CORS:

- Confirma que tu dominio exacto (esquema + host + puerto) está en
  `ALLOWED_ORIGIN` del entorno del IS.
- Las cabeceras permitidas son solo `Content-Type` y `Authorization`; no
  envíes cabeceras custom en las peticiones al IS.
- Métodos permitidos: `GET, POST, PATCH, DELETE, OPTIONS`.
- `credentials: true` está activado — tu `fetch` debe usar
  `credentials: "include"` para que la cookie de sesión viaje.
- Las llamadas servidor-a-servidor (tu backend → IS, sin `Origin`) no pasan
  por esta validación, así que tu backend puede llamar al IS sin estar en la
  lista.

## 7. Autenticación vs. autorización: qué hace el IS y qué no

El IS te da una identidad verificada (`sub`, `email`, `name`,
`emailVerified`) y, si el login se hizo con `systemSlug`, el sistema al que
pertenece esa sesión. **No** incluye en el JWT los roles del usuario, y los
endpoints de escritura de `/api/roles` / `/api/user-roles` solo son
accesibles para administradores del sistema `auth` (`requireAdmin`, pensado
para la consola de administración del propio IS).

Para conocer tus propios roles sin ser admin, usa el endpoint de solo
lectura `GET /api/user-roles/me?systemSlug=...` (requiere sesión, sin
`requireAdmin`; ver [sección 10](#10-referencia-rápida-de-endpoints)). Es la
forma recomendada de resolver "¿qué rol(es) tiene este usuario en mi
sistema?" desde tu backend: reenvía el mismo `Authorization: Bearer <JWT>`
que ya verificaste contra el JWKS. Responde
`{ roles: [{ id, name, description, system: { id, slug, name } }] }`.

```ts
// src/middleware/requireRole.ts
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "@/middleware/verifyIdentity";

const IDENTITY_SERVER_URL = process.env.IDENTITY_SERVER_URL!;
const SYSTEM_SLUG = "pos"; // el slug de TU sistema, registrado en el IS

// Debe ejecutarse DESPUÉS de requireIdentity (necesita el bearer original).
export function requireRole(roleName: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const bearer = req.header("authorization")!.slice(7);
    const r = await fetch(
      `${IDENTITY_SERVER_URL}/api/user-roles/me?systemSlug=${SYSTEM_SLUG}`,
      { headers: { Authorization: `Bearer ${bearer}` } },
    );
    if (!r.ok) {
      return res
        .status(502)
        .json({ error: "IS no disponible", code: "IS_UNAVAILABLE" });
    }
    const { roles } = await r.json();
    if (!roles.some((role: { name: string }) => role.name === roleName)) {
      return res
        .status(403)
        .json({ error: "Rol insuficiente", code: "FORBIDDEN" });
    }
    next();
  };
}
```

```ts
app.delete(
  "/api/orders/:id",
  requireIdentity,
  requireRole("cajero"),
  (req, res) => {
    // ...
  },
);
```

> Esto añade una llamada de red al IS por request protegida con
> `requireRole`. Si te preocupa la latencia o el acoplamiento, cachea el
> resultado unos segundos por `sub`, o resuelve el rol una vez en el login y
> guárdalo en tu propia sesión/JWT interno.

**Recomendación:** trata al IS como tu proveedor de **autenticación** y de
roles básicos por sistema (vía `/api/user-roles/me`). Si tu sistema necesita
permisos más finos que un simple rol (p. ej. permisos por recurso), esos
deben vivir en tu propio backend, indexados por `identity.sub` (el
`user.id` del IS).

## 8. Rate limiting

Endpoints con límite (`src/middleware/auth-rate-limits.ts`, `src/middleware/rate-limit.ts`):

| Endpoint                             | Límite            | Dimensión           |
| ------------------------------------ | ----------------- | ------------------- |
| `POST /api/auth/sign-in`             | 10/min y 10/15min | IP y cuenta (email) |
| `POST /api/auth/sign-up`             | 5/min             | IP                  |
| `POST /api/users/me/change-password` | 5/min             | IP                  |
| `POST /api/users/me/change-email`    | 5/min             | IP                  |
| `GET /api/auth/jwks`                 | 60/min            | IP                  |
| `GET /api/auth/token`                | 60/min            | IP                  |

Al superar el límite reciben `429` con cabecera `Retry-After` (segundos) y cuerpo
`{ "error": "...", "code": "RATE_LIMITED" }`. Tu cliente debe:

- Mostrar el mensaje de "demasiados intentos" sin reintentar automáticamente
  antes de `Retry-After`.
- No implementar reintentos agresivos en bucle: si Redis cae, el limitador
  degrada a un contador **en memoria por instancia** (nunca _fail-open_), y un
  circuit breaker deja de consultar a Redis durante ~30s tras varios fallos
  seguidos para no penalizar cada petición con el timeout.

## 9. Formato de errores

Todas las respuestas de error siguen `{ error: string, code?: string }`
(`ErrorResponseSchema`, `src/openapi/schemas.ts:59-64`). Códigos relevantes
para integradores: `UNAUTHORIZED` (401), `FORBIDDEN` (403, falta rol admin),
`RATE_LIMITED` (429), `CONFLICT` (409, violación de unicidad),
`SYSTEM_NOT_FOUND` / `SYSTEM_REQUIRED` (400, `systemSlug` inválido o
ausente en sign-in/sign-up).

## 10. Referencia rápida de endpoints

| Método     | Ruta                                                              | Auth requerida   | Descripción                                                                   |
| ---------- | ----------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| POST       | `/api/auth/sign-in`                                               | — (rate limited) | Login; requiere `systemSlug`                                                  |
| POST       | `/api/auth/sign-up`                                               | Sesión + admin   | Alta de usuario (no autoservicio)                                             |
| POST       | `/api/employees/with-user`                                        | Sesión + admin   | Crea usuario **y** su empleado enlazado a la vez                              |
| POST       | `/api/auth/sign-out`                                              | Sesión           | Cierra la sesión actual                                                       |
| GET        | `/api/auth/token`                                                 | Sesión           | Emite/renueva un JWT                                                          |
| GET        | `/api/auth/jwks`                                                  | — (pública)      | Claves públicas para verificar JWT                                            |
| GET        | `/api/sessions/session`                                           | Sesión           | Usuario, sesión y sistema actuales                                            |
| GET/DELETE | `/api/sessions*`                                                  | Sesión           | Listar/revocar sesiones propias                                               |
| GET/PATCH  | `/api/users/me*`                                                  | Sesión           | Perfil propio; cambio de contraseña/email (ambos exigen la contraseña actual) |
| GET        | `/api/user-roles/me`                                              | Sesión           | Mis roles, opcionalmente filtrados por `systemSlug`                           |
| CRUD       | `/api/systems`, `/api/roles`, `/api/user-roles`, `/api/employees` | Sesión + admin   | Administración centralizada (consola interna)                                 |
| GET        | `/health`                                                         | — (pública)      | Liveness: el proceso responde (no toca BD)                                    |
| GET        | `/health/ready`                                                   | — (pública)      | Readiness: además comprueba la BD (`503` si no responde)                      |

### 10.1 Alta combinada de usuario + empleado

`POST /api/employees/with-user` (sesión + admin) crea en una sola llamada el
**usuario** y el **empleado** ya enlazado a él, evitando encadenar
`POST /api/auth/sign-up` seguido de `POST /api/employees` desde el cliente. El
cuerpo anida ambos recursos para no confundir el `name` del usuario (nombre
visible) con el `name` del empleado (nombre de pila). El `userId` del empleado
no se envía: lo fija el servidor con el id del usuario recién creado.

```jsonc
// POST /api/employees/with-user
{
  "user": {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "password": "tu-contraseña-segura", // min 12, max 128 (política de better-auth)
  },
  "employee": {
    "name": "Ada",
    "lastName": "Lovelace",
    "ci": "12345678",
    // birthday, phoneNumber, address, inDate, outDate, active son opcionales
  },
}
// 201 → { "user": { /* User */ }, "employee": { /* Employee */ } }
```

No hay una transacción única que abarque los dos pasos: el alta del usuario la
realiza better-auth, que escribe en la BD por su cuenta y queda fuera del
control de una transacción de Drizzle. Para que el resultado sea consistente el
endpoint usa **pre-chequeo + compensación**: comprueba que el CI no exista
antes de crear el usuario (así un CI duplicado responde `409` sin dejar ninguna
cuenta), y si el `INSERT` del empleado fallara igualmente (p. ej. una carrera),
borra el usuario recién creado para no dejar cuentas huérfanas. El alta no
asigna roles: para que el nuevo usuario pueda iniciar sesión en un sistema hay
que darle un rol con `POST /api/user-roles`.

### 10.2 Paginación y filtros en listados

Los listados administrativos —`GET /api/employees`, `GET /api/systems`,
`GET /api/roles` y `GET /api/user-roles`— están **paginados** y aceptan
filtros por query string:

| Parámetro  | Tipo           | Por defecto | Aplica a                  | Descripción                                 |
| ---------- | -------------- | ----------- | ------------------------- | ------------------------------------------- |
| `page`     | entero         | `1`         | todos                     | Página, 1-indexada.                         |
| `limit`    | entero         | `20`        | todos                     | Elementos por página, acotado a `[1, 100]`. |
| `search`   | texto          | —           | employees, systems, roles | Búsqueda parcial (insensible a mayúsculas). |
| `active`   | `true`/`false` | —           | employees, systems        | Filtra por estado activo.                   |
| `systemId` | texto          | —           | roles                     | Filtra los roles de un sistema.             |
| `userId`   | texto          | —           | user-roles                | Filtra las asignaciones de un usuario.      |
| `roleId`   | texto          | —           | user-roles                | Filtra las asignaciones de un rol.          |

El campo de `search` cubre: nombre/apellido/CI en empleados, nombre/slug en
sistemas y nombre en roles.

Cada respuesta incluye el array de recursos **y** un objeto `pagination` con
los totales, de modo que el cliente puede construir la navegación sin llamadas
extra:

```jsonc
// GET /api/employees?page=1&limit=20&active=true&search=ada
{
  "employees": [/* ... hasta `limit` elementos ... */],
  "pagination": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 },
}
```

`totalPages` vale `0` cuando no hay resultados. Los `limit` fuera de rango o los
`page`/`limit` no numéricos se rechazan con `400` (validación de query). Los
listados propios del usuario (`GET /api/sessions`, `GET /api/user-roles/me`) no
se paginan: devuelven el conjunto completo del propio usuario.

En entornos no productivos (`APP_ENV !== "production"`), el esquema completo
está disponible en `GET /api/openapi.json` y Swagger UI en `GET /api/docs`
(`src/app.ts`) — en producción se deshabilita intencionalmente. El fichero
`postman/elineas-auth.openapi.json` se regenera con `bun run openapi:generate`
tras cambiar rutas o esquemas.

## 11. Checklist de seguridad para producción

- [ ] Tu dominio está en `ALLOWED_ORIGIN` del IS (y solo el tuyo, evita comodines).
- [ ] Tu frontend usa `credentials: "include"` y HTTPS en todo momento (cookies `secure`).
- [ ] El JWT se guarda solo en memoria en el frontend, nunca en `localStorage`/`sessionStorage`.
- [ ] Tu backend verifica el JWT contra el JWKS del IS (`createRemoteJWKSet`), validando `issuer`.
- [ ] Tu backend no confía en claims de rol del JWT (no existen); si necesita roles, los pide a `GET /api/user-roles/me` o implementa su propia autorización indexada por `sub`.
- [ ] `APP_ENV=production` en el IS para que `/api/docs` y `/api/openapi.json` queden deshabilitados.
- [ ] `BETTER_AUTH_SECRET` y `REDIS_PASSWORD` gestionados como secretos (no en el repo).
- [ ] Tu cliente maneja `401` (token vencido → renovar o cerrar sesión) y `429` (backoff, sin reintento en bucle).
- [ ] Si el IS va detrás de un reverse proxy, `TRUST_PROXY_HOPS` = nº de proxies de confianza (por defecto `0`). Dejarlo en `0` con un proxy delante hace que todas las peticiones compartan la IP del proxy y los usuarios legítimos se rate-limiten entre sí.
- [ ] La monitorización sondea `GET /health` (liveness) y `GET /health/ready` (readiness) y reinicia/reprograma el contenedor si fallan.
- [ ] `RESEND_API_KEY` definida (como secreto) y el dominio de `EMAIL_FROM` verificado en Resend; sin ella no se envían los correos de credenciales. No definas `SMTP_HOST` en producción (apuntaría los correos a un SMTP sin autenticar).

## 12. Resiliencia y operación

El IS está endurecido para no quedarse colgado ante fallos de sus dependencias
(BD/Redis) ni ante errores inesperados:

- **Timeouts en cascada**: cada query tiene `statement_timeout`/`query_timeout`
  (10-12s) y cada petición HTTP un `timeout` global de 15s (`504`). Una query o
  un handler colgados se abortan en vez de retener conexiones del pool
  indefinidamente (lo que agotaría el pool y tumbaría toda la API).
- **Pool de Postgres**: máx. 20 conexiones, con un listener de `error` que evita
  que la caída de una conexión idle (reinicio de BD, failover) tumbe el proceso.
- **Redis**: timeout por comando (250ms) + circuit breaker (abre 30s tras 5
  fallos) para que un Redis caído/lento no penalice cada petición; el rate
  limiter degrada a memoria por instancia.
- **Health checks**: `GET /health` (liveness, no toca BD) y `GET /health/ready`
  (readiness con `SELECT 1`). El `healthcheck` de compose los usa para reiniciar
  un contenedor vivo-pero-colgado (algo que `restart: unless-stopped` no cubre).
- **Apagado ordenado**: ante `SIGTERM`/`SIGINT` deja de aceptar conexiones,
  drena el pool y cierra Redis antes de salir.
- **Errores de proceso**: `unhandledRejection` se registra sin tumbar el
  servidor; `uncaughtException` registra y sale con código de error para que el
  orquestador levante un proceso limpio.
