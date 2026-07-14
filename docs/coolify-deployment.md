# Desplegar en Coolify 4

Esta guía despliega la API en un servidor con [Coolify](https://coolify.io)
4.x como **tres recursos separados** dentro de un mismo Proyecto/Entorno:
Postgres, Redis y la API (`@elineas/auth`). Es el enfoque más robusto porque
cada pieza se despliega, escala y redeploya de forma independiente, y es el
que Coolify soporta de forma más estable (recursos "Application" con build
desde Dockerfile + bases de datos gestionadas).

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
   └─ api        (Application, Dockerfile → Dockerfile) — dominio api.tudominio.com
```

Todos los recursos de un mismo Proyecto+Entorno en Coolify comparten la red
Docker interna del servidor, por lo que la API alcanza Postgres/Redis por su
nombre de contenedor sin exponerlos a Internet. Los consumidores (frontends,
otros backends) llaman a la API por su dominio público
(`https://api.tudominio.com`).

## 1. Prerrequisitos

- Un servidor con Coolify 4 instalado y conectado (Server → "Validated").
- El repositorio en un proveedor Git que Coolify pueda leer (GitHub/GitLab/Gitea,
  público o con la integración de Coolify configurada).
- Un dominio/subdominio apuntando (registro A) a la IP del servidor, p. ej.
  `api.tudominio.com`.
- El `Dockerfile` del repo ya construye `prod` como **último stage**, así que
  Coolify no necesita seleccionar un "build target" explícito: un
  `docker build` sin `--target` construye automáticamente el último stage. Si
  tu versión de Coolify expone un campo "Docker Build Stage"/"target", puedes
  dejarlo vacío o poner `prod` — es equivalente.

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
   la necesitas para la API.
4. Despliega el recurso (Start/Deploy). Espera a que el estado sea "Running"/"Healthy".
5. **No** le asignes dominio ni puerto público: solo debe ser accesible desde
   la red interna.

## 4. Base de datos: Redis

1. **+ New Resource → Databases → Redis**.
2. Nombre: `redis`. Actívale contraseña si Coolify no lo hace por defecto.
3. Copia la cadena de conexión interna que te da Coolify
   (`redis://:password@<nombre-del-recurso>:6379`).
4. Despliega y espera a que esté sano. Redis es opcional (si no se define
   `REDIS_URL`, el rate limiting cae a memoria por instancia), pero en
   producción con más de una réplica de la API es necesario para que el rate
   limiting sea consistente entre instancias.

## 5. API (`@elineas/auth`)

1. **+ New Resource → Application**.
2. Fuente: tu repositorio Git + rama a desplegar (p. ej. `main`).
3. **Build Pack: Dockerfile**.
4. Configuración de build:
   - **Base Directory** (contexto de build): `/` (la raíz del repo).
   - **Dockerfile Location**: `Dockerfile`.
   - Deja el build target/stage vacío o `prod` (ver nota de la sección 1).
5. **Puerto expuesto**: `8080` (es el puerto en el que escucha `src/index.ts`).
6. **Health check**: path `/health`, puerto `8080` (coincide con el
   healthcheck ya definido en `Dockerfile`/`docker-compose.prod.yml`).
7. **Variables de entorno** (pestaña Environment Variables del recurso). Usa
   como referencia `.env.example`:

   | Variable | Valor |
   | --- | --- |
   | `APP_ENV` | `production` |
   | `DATABASE_URL` | la cadena interna de Postgres del paso 3 |
   | `REDIS_URL` | la cadena interna de Redis del paso 4 (opcional) |
   | `BETTER_AUTH_SECRET` | genera uno: `openssl rand -hex 32` |
   | `BETTER_AUTH_URL` | `https://api.tudominio.com` (la URL pública de esta API) |
   | `ALLOWED_ORIGIN` | dominio(s) de los consumidores (frontends/backends), separados por comas |
   | `TRUST_PROXY_HOPS` | `1` (Coolify pone un proxy Traefik delante — **importante**, ver nota abajo) |

   > **`TRUST_PROXY_HOPS=1` es obligatorio en Coolify.** El proxy de Coolify
   > (Traefik) termina TLS y reenvía cada petición al contenedor. Con
   > `TRUST_PROXY_HOPS=0` (el valor por defecto pensado para exposición
   > directa sin proxy), el rate limiting vería la IP del proxy en vez de la
   > del cliente real y trataría a todos los usuarios como uno solo. Con `1`,
   > el middleware de rate limiting (`src/middleware/rate-limit.ts`) confía en
   > el primer salto de `X-Forwarded-For`.

8. **Dominio**: en la pestaña Domains del recurso, añade
   `https://api.tudominio.com`. Coolify configura Traefik y solicita el
   certificado Let's Encrypt automáticamente (asegúrate de que el DNS ya
   resuelve a la IP del servidor antes de desplegar, o la emisión del
   certificado fallará).
9. **Deploy**. Sigue el log de build: como se explica en el README, el
   Dockerfile ejecuta `tsc --noEmit` antes de generar el bundle — si hay
   errores de tipos, el deploy fallará aquí (correcto).

## 6. Migraciones de base de datos

La API no migra automáticamente al arrancar (a propósito: migrar en cada
arranque de cada réplica es peligroso). Tras el primer deploy exitoso:

1. Abre el recurso de la API en Coolify y usa su **terminal / "Execute
   Command"** (la función de shell hacia el contenedor en ejecución, presente
   en todas las versiones 4.x bajo el propio recurso).
2. La imagen `prod` **no** incluye `drizzle-kit` (solo el bundle), así que la
   migración no se puede correr desde ahí. Opciones:
   - **Opción A (recomendada): un recurso Application aparte solo para
     migraciones**, usando el mismo Dockerfile pero con:
     - Dockerfile Location: `Dockerfile`
     - Build target/stage: `dev` (esa etapa sí incluye `drizzle-kit` y la
       carpeta `migrations/`)
     - Sin dominio ni puerto público, sin "Start" automático.
     - Comando de arranque (Start/Custom Command):
       `bunx --env-file=/dev/null drizzle-kit migrate`
     - Mismas variables `DATABASE_URL`/`APP_ENV` que la API.
     - Lo despliegas/ejecutas manualmente cada vez que haya migraciones
       nuevas.
   - **Opción B:** conéctate por Coolify a un contenedor que sí tenga el
     stage `dev` desplegado temporalmente (p. ej. redeploy puntual de la API
     con target `dev`, ejecuta la migración por terminal, y vuelve a `prod`).
     Más manual, pero no requiere crear un recurso adicional.

## 7. Verificación end-to-end

1. Abre `https://api.tudominio.com/health` — debe responder `{"status":"ok"}`.
2. Abre `https://api.tudominio.com/health/ready` — confirma que la BD responde.
3. Desde un consumidor real (frontend/backend), confirma que las llamadas a
   `https://api.tudominio.com/api/...` no fallan por CORS (si fallan, revisa
   que `ALLOWED_ORIGIN` incluya exactamente el origen que llama, sin barra
   final, y **redeploya la API** tras corregirlo — las variables de entorno no
   se aplican en caliente).

## 8. Redeploy y actualizaciones

- **Redeploy manual**: botón "Redeploy" en el recurso.
- **Auto-deploy en push**: activa el webhook de Coolify para la rama que
  despliegas (pestaña del recurso → Webhooks/Git). Cada push reconstruye el
  recurso.
- **Cambios en variables de entorno** (`DATABASE_URL`, `ALLOWED_ORIGIN`, etc.):
  requieren redeploy del recurso para que el contenedor arranque con el
  entorno nuevo.
- **Migraciones nuevas**: redeploy del recurso de migraciones (sección 6)
  antes o después del deploy de la API, según si la migración es compatible
  con el código anterior.

## 9. Alternativa: un solo recurso "Docker Compose"

Si prefieres desplegar todo con `docker-compose.prod.yml` como una única
unidad (menos recursos que administrar, pero menos control por servicio):

1. **+ New Resource → Docker Compose**, apuntando al repo y seleccionando
   `docker-compose.prod.yml`.
2. Define en la pestaña de variables de entorno del recurso las variables que
   el compose requiere: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`.
3. Coolify puede necesitar que el servicio que quieres exponer por dominio use
   sus variables "mágicas" de compose (del tipo
   `SERVICE_FQDN_<SERVICE>`/`SERVICE_URL_<SERVICE>`) para autoconfigurar
   Traefik sin publicar puertos al host. La sintaxis exacta y el
   comportamiento han cambiado entre versiones de Coolify 4 — revisa la
   documentación de tu versión antes de depender de esto; si no está
   disponible o no te convence, puedes publicar el puerto de la API en
   `docker-compose.prod.yml` y poner tu propio proxy/dominio delante
   manualmente.
4. Las migraciones no corren automáticamente (no hay un servicio dedicado en
   el compose): ejecútalas manualmente contra el contenedor `api`, igual que
   en la opción B de la sección 6.

Este enfoque es más rápido de configurar inicialmente, pero el enfoque de
recursos separados (secciones 2-8) da más control granular (redeploy
independiente, health checks por servicio, escalado independiente) y es el
recomendado para producción.

## 10. Checklist rápido

- [ ] Postgres y Redis desplegados y sanos, sin dominio ni puerto público.
- [ ] API desplegada, `TRUST_PROXY_HOPS=1`, `ALLOWED_ORIGIN` con los orígenes
      correctos, dominio propio con SSL activo, `/health` responde 200.
- [ ] Migraciones aplicadas (recurso `dev` con `drizzle-kit migrate`, o
      terminal manual).
- [ ] Sin errores de CORS en la consola del navegador del consumidor.
