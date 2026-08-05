# Despliegue en el servidor — acceso a la base de datos

Este proyecto **no abre ninguna conexión a Postgres**. Es el frontend del
Identity Server: todo pasa por la API de `elineas-auth`. Este archivo dice qué
redes le hacen falta, qué red **no**, y cómo desplegarlo.

## 1. Por qué no toca la BD

No hay `DATABASE_URL` en el proyecto. La BD la habla la API
(`elineas-auth-api`), y este frontend solo habla con esa API.

**No añadas este contenedor a `elineas_default`.** Esa es la red de la BD
principal, con subred fija 10.0.5.0/24 porque el `pg_hba.conf` de `ELINEAS_BD`
solo admite:

```
host    all             all             10.0.5.0/24             scram-sha-256
```

Un frontend en esa subred podría alcanzar el puerto de Postgres directamente, con
la contraseña como única barrera. No hay ninguna razón para darle ese camino: la
separación API ↔ frontend es justo lo que queremos conservar.

## 2. Redes que usa este stack

| Red | Nombre real | Quién la crea | Para qué |
| --- | --- | --- | --- |
| `elineas-auth` | `elineas-auth-net` | a mano, una vez | frontend → `elineas-auth-api` por nombre de contenedor |
| `caddy` | `caddy-net` | el stack de Caddy | el proxy externo llega a este contenedor |

```bash
docker network create elineas-auth-net    # solo si no existe
docker network inspect caddy-net > /dev/null || echo 'falta caddy-net: levanta antes el stack de Caddy'
```

Ambas se declaran `external`: si falta cualquiera, `up` falla con
`network ... declared as external, but could not be found`.

Ojo con el desfase entre los dos compose de este proyecto: el de desarrollo
apunta a `elineas-auth_default` y el de producción a `elineas-auth-net`. En el
servidor manda el de producción.

## 3. Variables de entorno

```bash
cd /srv/elineas-auth-frontend
cp .env.production.example .env.production    # si aún no existe
```

| Variable | Valor en el servidor |
| --- | --- |
| `AUTH_API_URL` | `http://elineas-auth-api:8080` — por nombre de contenedor sobre `elineas-auth-net`. Es tráfico servidor-a-servidor dentro de Docker, no pasa por internet ni por el puerto publicado. |
| `AUTH_SYSTEM_SLUG` | el slug del sistema registrado en el Identity Server para este frontend |

El `8080` es el puerto **interno** de la API, no el `3001` que publica al host.
Por nombre de contenedor se usa siempre el interno.

Si en el navegador hay llamadas directas a la API (no proxied por este servidor),
esas van a `https://auth.mercadoelineas.com` y ese origen tiene que estar en el
`ALLOWED_ORIGIN` de `elineas-auth`, o CORS las bloquea.

## 4. Desplegar

```bash
cd /srv/elineas-auth-frontend
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f frontend
```

Queda en el `3000` del host, y el Caddy externo le hace proxy por `caddy-net`.

## 5. Verificar

```bash
# Redes: elineas-auth-net y caddy-net. NUNCA elineas_default ni una IP 10.0.5.x
docker inspect elineas-auth-frontend \
  --format '{{range $n, $c := .NetworkSettings.Networks}}{{$n}} {{$c.IPAddress}}{{"\n"}}{{end}}'

# Que alcance la API por nombre de contenedor
docker exec elineas-auth-frontend wget -qO- http://elineas-auth-api:8080/health
```

Si el segundo comando da `getaddrinfo ENOTFOUND elineas-auth-api`, los dos
contenedores no están en la misma red: comprueba que `elineas-auth` se levantó
con el compose de producción y está en `elineas-auth-net`.
