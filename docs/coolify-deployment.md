# Desplegar en Coolify 4

Esta guía despliega el monorepo en un servidor con [Coolify](https://coolify.io)
4.x como **cuatro recursos separados** dentro de un mismo Proyecto/Entorno:
Postgres, Redis, el backend (`@elineas/backend`) y el frontend
(`@elineas/frontend`). Es el enfoque más robusto porque cada pieza se
despliega, escala y redeploya de forma independiente, y es el que Coolify
soporta de forma más estable (recursos "Application" con build desde
Dockerfile + bases de datos gestionadas).

Al final se documenta también una alternativa vía **Docker Compose** para
quien prefiera mantener la infraestructura como código en el propio repo.

> **Antes de empezar:** las capturas de pantalla y nombres exactos de campos en
> la UI de Coolify pueden variar ligeramente entre versiones 4.x. Esta guía usa
> los conceptos estables (Application, Dockerfile buildpack, dominios,
> variables de entorno, terminal del contenedor); si algún campo no aparece
> exactamente con ese nombre en tu instancia, busca el equivalente más cercano
> en la documentación oficial de tu versión.

## 0. Arquitectura en Coolify

```
Proyecto: elineas-auth
└─ Entorno: production
   ├─ postgres   (Database, gestionada por Coolify)
   ├─ redis      (Database, gestionada por Coolify)
   ├─ backend    (Application, Dockerfile → apps/backend/Dockerfile) — dominio api.tudominio.com
   └─ frontend   (Application, Dockerfile → apps/frontend/Dockerfile) — dominio admin.tudominio.com
```

Todos los recursos de un mismo Proyecto+Entorno en Coolify comparten la red
Docker interna del servidor, por lo que el **frontend** puede llamar al
**backend** por su nombre de contenedor (`http://backend:8080`) sin exponerlo
a Internet. El **navegador** del usuario, en cambio, llama al backend por su
dominio público (`https://api.tudominio.com`).

## 1. Prerrequisitos

- Un servidor con Coolify 4 instalado y conectado (Server → "Validated").
- El repositorio en un proveedor Git que Coolify pueda leer (GitHub/GitLab/Gitea,
  público o con la integración de Coolify configurada).
- Dos dominios/subdominios apuntando (registro A) a la IP del servidor:
  - `api.tudominio.com` → backend
  - `admin.tudominio.com` → frontend
- Los Dockerfiles del repo ya construyen `prod` como **último stage**
  (`apps/backend/Dockerfile`, `apps/frontend/Dockerfile`), así que Coolify no
  necesita seleccionar un "build target" explícito: un `docker build` sin
  `--target` construye automáticamente el último stage. Si tu versión de
  Coolify expone un campo "Docker Build Stage"/"target", puedes dejarlo vacío
  o poner `prod` — es equivalente.

## 2. Crear el Proyecto y el Entorno

1. En Coolify, **Projects → New Project** (p. ej. `elineas-auth`).
2. Dentro del proyecto, usa el entorno por defecto (`production`) o crea uno.
   Todos los recursos que crees a continuación deben ir en el **mismo**
   proyecto + entorno + servidor, para compartir red interna.

## 3. Base de datos: Postgres

1. **+ New Resource → Databases → PostgreSQL**.
2. Nombre: `postgres` (o el que prefieras; lo importante es el que uses luego
   para construir `DATABASE_URL`).
3. Coolify genera usuario/contraseña/nombre de BD automáticamente y te muestra
   la cadena de conexión **interna** (algo como
   `postgres://usuario:password@<nombre-del-recurso>:5432/<db>`) — cópiala,
   la necesitas para el backend.
4. Despliega el recurso (Start/Deploy). Espera a que el estado sea "Running"/"Healthy".
5. **No** le asignes dominio ni puerto público: solo debe ser accesible desde
   la red interna (igual que en `docker-compose.prod.yml`, donde Postgres no
   publica puertos al host).

## 4. Base de datos: Redis

1. **+ New Resource → Databases → Redis**.
2. Nombre: `redis`. Actívale contraseña si Coolify no lo hace por defecto.
3. Copia la cadena de conexión interna que te da Coolify
   (`redis://:password@<nombre-del-recurso>:6379`).
4. Despliega y espera a que esté sano. Redis es opcional para el backend (si
   no se define `REDIS_URL`, el rate limiting cae a memoria por instancia),
   pero en producción con más de una réplica del backend es necesario para que
   el rate limiting sea consistente entre instancias.

## 5. Backend (`@elineas/backend`)

1. **+ New Resource → Application**.
2. Fuente: tu repositorio Git + rama a desplegar (p. ej. `main`).
3. **Build Pack: Dockerfile**.
4. Configuración de build:
   - **Base Directory** (contexto de build): `/` (la raíz del repo — el
     Dockerfile necesita el `bun.lock` y los `package.json` de todos los
     workspaces para resolver correctamente).
   - **Dockerfile Location**: `apps/backend/Dockerfile`.
   - Deja el build target/stage vacío o `prod` (ver nota de la sección 1).
5. **Puerto expuesto**: `8080` (es el puerto en el que escucha
   `apps/backend/src/index.ts`).
6. **Nombre de contenedor / hostname**: si tu versión de Coolify permite fijar
   un nombre de contenedor personalizado, pon `backend`. Es el nombre que
   usará el frontend para alcanzarlo por la red interna
   (`BACKEND_INTERNAL_URL=http://backend:8080`). Si Coolify no expone ese
   campo en tu versión, anota el nombre de contenedor que asigne
   automáticamente (visible en la pestaña del recurso o con `docker ps`) y
   usa ese en el paso 7.
7. **Health check**: path `/health`, puerto `8080` (coincide con el
   healthcheck ya definido en `apps/backend/Dockerfile`/`docker-compose.prod.yml`).
8. **Variables de entorno** (pestaña Environment Variables del recurso). Usa
   como referencia `apps/backend/.env.example`:

   | Variable | Valor |
   | --- | --- |
   | `APP_ENV` | `production` |
   | `DATABASE_URL` | la cadena interna de Postgres del paso 3 |
   | `REDIS_URL` | la cadena interna de Redis del paso 4 (opcional) |
   | `BETTER_AUTH_SECRET` | genera uno: `openssl rand -hex 32` |
   | `BETTER_AUTH_URL` | `https://api.tudominio.com` (la URL pública de este backend) |
   | `ALLOWED_ORIGIN` | `https://admin.tudominio.com` (dominio del frontend, paso 6) |
   | `TRUST_PROXY_HOPS` | `1` (Coolify pone un proxy Traefik delante — **importante**, ver nota abajo) |

   > **`TRUST_PROXY_HOPS=1` es obligatorio en Coolify.** El proxy de Coolify
   > (Traefik) termina TLS y reenvía cada petición al contenedor. Con
   > `TRUST_PROXY_HOPS=0` (el valor por defecto pensado para exposición
   > directa sin proxy), el rate limiting vería la IP del proxy en vez de la
   > del cliente real y trataría a todos los usuarios como uno solo. Con `1`,
   > el middleware de rate limiting (`apps/backend/src/middleware/rate-limit.ts`)
   > confía en el primer salto de `X-Forwarded-For`.

9. **Dominio**: en la pestaña Domains del recurso, añade
   `https://api.tudominio.com`. Coolify configura Traefik y solicita el
   certificado Let's Encrypt automáticamente (asegúrate de que el DNS ya
   resuelve a la IP del servidor antes de desplegar, o la emisión del
   certificado fallará).
10. **Deploy**. Sigue el log de build: como se explica en el README, el
    Dockerfile ejecuta `tsc --noEmit` antes de generar el bundle — si hay
    errores de tipos, el deploy fallará aquí (correcto).

## 6. Migraciones de base de datos

El backend no migra automáticamente al arrancar (a propósito: migrar en cada
arranque de cada réplica es peligroso). Tras el primer deploy exitoso:

1. Abre el recurso `backend` en Coolify y usa su **terminal / "Execute
   Command"** (la función de shell hacia el contenedor en ejecución, presente
   en todas las versiones 4.x bajo el propio recurso).
2. La imagen `prod` del backend **no** incluye `drizzle-kit` (solo el bundle).
   Dos opciones:
   - **Opción A (recomendada): un recurso Application aparte solo para
     migraciones**, usando el mismo Dockerfile pero con:
     - Dockerfile Location: `apps/backend/Dockerfile`
     - Build target/stage: `dev` (esa etapa sí incluye `drizzle-kit` y la
       carpeta `migrations/`)
     - Sin dominio ni puerto público, sin "Start" automático.
     - Comando de arranque (Start/Custom Command):
       `bunx --env-file=/dev/null drizzle-kit migrate`
     - Mismas variables `DATABASE_URL`/`APP_ENV` que el backend.
     - Lo despliegas/ejecutas manualmente cada vez que haya migraciones
       nuevas (equivalente al servicio `migrate` de `docker-compose.prod.yml`,
       que usa el mismo truco: target `dev` en vez de `prod`).
   - **Opción B:** conéctate por Coolify a un contenedor que sí tenga el
     stage `dev` desplegado temporalmente (p. ej. redeploy puntual del backend
     con target `dev`, ejecuta la migración por terminal, y vuelve a `prod`).
     Más manual, pero no requiere crear un recurso adicional.

## 7. Frontend (`@elineas/frontend`)

1. **+ New Resource → Application** (mismo proyecto/entorno que el backend).
2. Misma fuente Git.
3. **Build Pack: Dockerfile**.
4. Configuración de build:
   - **Base Directory**: `/` (raíz del repo — igual que el backend, necesita
     el lockfile y los `package.json` de los workspaces, incluido
     `packages/api-client` y `apps/backend` para resolver el contrato RPC).
   - **Dockerfile Location**: `apps/frontend/Dockerfile`.
   - Build target/stage: vacío o `prod` (es el último stage).
   - **Build Argument**: `VITE_BACKEND_URL=https://api.tudominio.com`. Esto es
     un **build-arg**, no una variable de entorno de runtime: se hornea en el
     bundle de JavaScript del navegador en tiempo de build. Si Coolify separa
     "Build Arguments" de "Environment Variables" en la UI, este va en Build
     Arguments. Si tu versión de Coolify no distingue y solo tiene un único
     lugar, defínela ahí — el `ARG VITE_BACKEND_URL` del Dockerfile la recoge igual.
5. **Puerto expuesto**: `3000`.
6. **Variables de entorno (runtime)**:

   | Variable | Valor |
   | --- | --- |
   | `BACKEND_INTERNAL_URL` | `http://backend:8080` (usa el nombre de contenedor real del backend, ver paso 5.6) |
   | `PORT` | `3000` |

7. **Health check**: path `/`, puerto `3000`.
8. **Dominio**: `https://admin.tudominio.com` en la pestaña Domains.
9. **Deploy**.

> **Si `BACKEND_INTERNAL_URL` no resuelve** (error `ENOTFOUND backend` en los
> logs del frontend): entra por terminal al contenedor del frontend y ejecuta
> `getent hosts backend` (o `nslookup backend`). Si no resuelve, backend y
> frontend no están en la misma red Docker — revisa que ambos recursos estén
> en el mismo Proyecto+Entorno+Servidor, o usa el nombre de contenedor exacto
> que Coolify asignó al backend (visible en Coolify o con `docker ps` en el
> servidor) en vez de `backend`.

## 8. Verificación end-to-end

1. Abre `https://admin.tudominio.com`. La página de inicio debe mostrar
   **"Backend alcanzable ✅ — respondió 401..."** (sin sesión es la respuesta
   esperada; confirma que el frontend alcanzó el backend por la red interna).
2. Abre `https://api.tudominio.com/health` directamente — debe responder
   `{"status":"ok"}`.
3. Desde las herramientas de red del navegador, confirma que las llamadas del
   frontend a `https://api.tudominio.com/api/...` no fallan por CORS (si
   fallan, revisa que `ALLOWED_ORIGIN` en el backend sea exactamente
   `https://admin.tudominio.com`, sin barra final, y **redeploya el backend**
   tras corregirlo — las variables de entorno no se aplican en caliente).

## 9. Redeploy y actualizaciones

- **Redeploy manual**: botón "Redeploy" en cada recurso.
- **Auto-deploy en push**: activa el webhook de Coolify para la rama que
  despliegas (pestaña del recurso → Webhooks/Git). Cada push reconstruye solo
  ese recurso.
- **Cambios de `VITE_BACKEND_URL`** (URL pública del backend): al ser un
  build-arg, requieren **reconstruir la imagen del frontend** (no basta un
  restart).
- **Cambios en variables de runtime** (`DATABASE_URL`, `ALLOWED_ORIGIN`,
  `BACKEND_INTERNAL_URL`, etc.): requieren redeploy del recurso afectado para
  que el contenedor arranque con el entorno nuevo.
- **Migraciones nuevas**: redeploy del recurso de migraciones (sección 6)
  antes o después del deploy del backend, según si la migración es
  compatible con el código anterior.

## 10. Alternativa: un solo recurso "Docker Compose"

Si prefieres desplegar todo con `docker-compose.prod.yml` como una única
unidad (menos recursos que administrar, pero menos control por servicio):

1. **+ New Resource → Docker Compose**, apuntando al repo y seleccionando
   `docker-compose.prod.yml`.
2. Define en la pestaña de variables de entorno del recurso las variables que
   el compose requiere: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`,
   `PUBLIC_BACKEND_URL`.
3. Coolify puede necesitar que los servicios que quieres exponer por dominio
   usen sus variables "mágicas" de compose (del tipo
   `SERVICE_FQDN_<SERVICE>`/`SERVICE_URL_<SERVICE>`) para autoconfigurar
   Traefik sin publicar puertos al host. La sintaxis exacta y el
   comportamiento han cambiado entre versiones de Coolify 4 — revisa la
   documentación de tu versión antes de depender de esto; si no está
   disponible o no te convence, puedes mantener los `ports:` publicados tal
   cual están en `docker-compose.prod.yml` y poner tu propio proxy/dominio
   delante manualmente.
4. El servicio `migrate` usa `profiles: ["migrate"]`, por lo que Coolify (que
   hace `docker compose up -d`, sin perfiles) **no** lo arrancará solo —
   tendrás que ejecutarlo manualmente por la terminal del servidor:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm migrate
   ```

Este enfoque es más rápido de configurar inicialmente, pero el enfoque de
recursos separados (secciones 2-9) da más control granular (redeploy
independiente, health checks por servicio, escalado independiente) y es el
recomendado para producción.

## 11. Checklist rápido

- [ ] Postgres y Redis desplegados y sanos, sin dominio ni puerto público.
- [ ] Backend desplegado, `TRUST_PROXY_HOPS=1`, `ALLOWED_ORIGIN` = dominio del
      frontend, dominio propio con SSL activo, `/health` responde 200.
- [ ] Migraciones aplicadas (recurso `dev` con `drizzle-kit migrate`, o
      terminal manual).
- [ ] Frontend desplegado con `VITE_BACKEND_URL` (build-arg, dominio público
      del backend) y `BACKEND_INTERNAL_URL` (runtime, nombre interno del
      backend), dominio propio con SSL activo.
- [ ] Página de inicio del frontend muestra "Backend alcanzable ✅".
- [ ] Sin errores de CORS en la consola del navegador.
