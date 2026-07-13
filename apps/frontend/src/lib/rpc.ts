import { createApiClient } from "@elineas/api-client";

// El backend se consume como servicio SEPARADO, y el frontend lo llama desde
// DOS contextos con direcciones potencialmente distintas:
//
// - Navegador (cliente): usa la URL PÚBLICA del backend. `import.meta.env.VITE_*`
//   se "hornea" en el bundle en tiempo de build, así que en Docker debe ser la
//   URL alcanzable desde el navegador del usuario (p. ej. http://localhost:8080).
// - Servidor (SSR / loaders de TanStack Start): corre dentro del contenedor del
//   frontend, donde "localhost" NO es el backend. Si existe `BACKEND_INTERNAL_URL`
//   (nombre del servicio en la red de Docker, p. ej. http://backend:8080) se usa
//   esa; si no, cae a la pública. En local (sin Docker) ambas coinciden en
//   localhost:8080.
const PUBLIC_BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:8080";

function resolveBackendBaseUrl(): string {
  // `typeof window === "undefined"` → estamos en el servidor.
  if (typeof window === "undefined") {
    return process.env.BACKEND_INTERNAL_URL ?? PUBLIC_BACKEND_URL;
  }
  return PUBLIC_BACKEND_URL;
}

// Cliente RPC tipado contra el grafo de rutas del servidor Hono (`AppType`).
// `credentials: "include"` envía la cookie de sesión de better-auth en las
// llamadas cross-origin (frontend en :3000, backend en :8080); requiere que el
// backend permita este origen en CORS (ALLOWED_ORIGIN) y responda con
// Access-Control-Allow-Credentials (ya configurado en el backend).
export const apiClient = createApiClient(resolveBackendBaseUrl(), {
  init: { credentials: "include" },
});
