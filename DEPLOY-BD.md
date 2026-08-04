# Despliegue en el servidor — acceso a la base de datos

Cómo dejar `elineas-auth-api` hablando con la BD principal (`ELINEAS_BD`).
Complementa el [README](README.md), que cubre el resto de la configuración.

## 1. El contrato de red

El `pg_hba.conf` de `ELINEAS_BD` tiene **una sola** regla de acceso remoto:

```
host    all             all             10.0.5.0/24             scram-sha-256
```

De ahí salen tres consecuencias que no son negociables:

1. **La conexión tiene que salir por una interfaz con IP en 10.0.5.0/24.** Esa
   subred es la de `elineas_default`, la red del proyecto `elineas` (el que
   levanta `ELINEAS_BD` y `elineas-backend`). Este stack la consume como
   `external`, con el alias local `elineas-db`.
2. **No sirve `host.docker.internal:5432`.** Por ahí el paquete sale al gateway
   del host, se NATea y llega a Postgres con una IP origen que ninguna regla
   acepta. Falla con `no pg_hba.conf entry for host ...`. Así estaba antes este
   compose; ya no.
3. **La subred de `elineas_default` tiene que estar fijada con `ipam`** en el
   compose del proyecto `elineas`. Si no lo está, Docker la saca del pool
   `10.0.0.0/8` por sorteo y al recrearse le toca otra — y todos los clientes de
   la BD se caen a la vez, con `pg_hba` rechazándolos sin explicación visible.

Verifica antes de desplegar:

```bash
docker network inspect elineas_default \
  --format '{{range .IPAM.Config}}{{.Subnet}} gw {{.Gateway}}{{end}}'
# debe imprimir: 10.0.5.0/24 gw 10.0.5.1
```

Si la red no existe, levanta primero el proyecto `elineas`. Este compose no la
crea: la declara `external`, y sin ella `up` falla con
`network elineas_default declared as external, but could not be found`.

## 2. Redes que usa este stack

| Red | Quién la crea | Para qué |
| --- | --- | --- |
| `elineas-auth-net` | a mano, una vez | `api` ↔ `redis` |
| `elineas_default` (alias `elineas-db`) | el compose de `elineas` | `api` → `ELINEAS_BD` |

```bash
docker network create elineas-auth-net    # solo si no existe
```

`redis` queda solo en `elineas-auth-net`: no tiene por qué ver la BD.

## 3. Variables de entorno

Dos sitios distintos, y confundirlos es el error más fácil de cometer:

| Archivo | Quién lo lee | Qué va aquí |
| --- | --- | --- |
| `.env` | `docker compose`, para interpolar `${...}` | `REDIS_PASSWORD` |
| `.env.production` | el contenedor, vía `env_file` | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ALLOWED_ORIGIN`, … |

`.env.production` **no** sirve para interpolar `${REDIS_PASSWORD}` en el compose:
compose solo lee `.env` (o el entorno del shell) para eso. Si falta, la URL de
Redis sale con la contraseña vacía y `api` no arranca.

```bash
cd /srv/elineas-auth
printf 'REDIS_PASSWORD=%s\n' "$(openssl rand -hex 32)" >> .env
```

La `DATABASE_URL` va en `.env.production`, apuntando al contenedor **por nombre**
(nunca `host.docker.internal`, ver § 1):

```
DATABASE_URL=postgres://USUARIO:PASS@ELINEAS_BD:5432/ELINEAS_BD
```

Los caracteres especiales de la contraseña van percent-encoded: `@` → `%40`,
`?` → `%3F`, `^` → `%5E`, `&` → `%26`, `=` → `%3D`, `%` → `%25`. Sin eso, la URL
se parsea mal y el fallo aparece como credenciales inválidas, no como URL mala.

## 4. Desplegar

```bash
cd /srv/elineas-auth
git pull

# Chequeos previos: los dos fallos que más cuestan de diagnosticar después.
docker network inspect elineas_default --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
grep -q '^DATABASE_URL=.*@ELINEAS_BD:' .env.production \
  || echo 'OJO: DATABASE_URL no apunta a ELINEAS_BD por nombre de contenedor'

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api
```

La API queda en el `3001` del host (`3001:8080`), detrás del Caddy externo.

## 5. Verificar que la conexión entra por la subred correcta

```bash
# La IP que este contenedor tiene en la red de la BD: debe ser 10.0.5.x
docker inspect elineas-auth-api \
  --format '{{range $n, $c := .NetworkSettings.Networks}}{{$n}} {{$c.IPAddress}}{{"\n"}}{{end}}'

# Y lo que ve Postgres del otro lado
docker exec ELINEAS_BD psql -U elineasadmin -d ELINEAS_BD \
  -c "SELECT usename, client_addr, application_name FROM pg_stat_activity WHERE client_addr IS NOT NULL;"
```

Si `client_addr` no es `10.0.5.x`, la conexión sigue saliendo por otro camino
(revisa que no quede `host.docker.internal` en `DATABASE_URL`).

## 6. Fallos típicos

| Síntoma | Causa |
| --- | --- |
| `network elineas_default declared as external, but could not be found` | el proyecto `elineas` no está levantado |
| `no pg_hba.conf entry for host "10.0.x.y"` | la conexión no sale por `elineas_default`; casi siempre `host.docker.internal` en `DATABASE_URL`, o la subred de la red cambió |
| `getaddrinfo ENOTFOUND ELINEAS_BD` | el contenedor no está en `elineas_default`, o la BD está parada |
| `password authentication failed` | contraseña mal percent-encoded en la URL |

## 7. Pendiente de seguridad

- La API conecta como **`elineasadmin`, un superusuario**. Debería tener su rol
  propio con permisos solo sobre sus tablas, como ya tiene el backend con
  `elineas_backend_app`.
- La contraseña de `elineasadmin` **estuvo en claro en `docker-compose.prod.yml`
  y sigue en el historial de git** (commit `43c69f5`). Sacarla del archivo no la
  borra del historial: hay que rotarla en Postgres.
- El `5432` de `ELINEAS_BD`, si está publicado al host, recibe conexiones
  NATeadas como `10.0.5.1` — que **sí** casa con la regla de `pg_hba`. Publícalo
  como `127.0.0.1:5432:5432` o quita el mapeo y usa `docker exec`.
