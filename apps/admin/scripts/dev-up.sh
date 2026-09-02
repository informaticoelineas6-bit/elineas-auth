#!/usr/bin/env bash
# Levanta el stack de desarrollo del frontend, asegurando primero que la API
# (proyecto hermano ../elineas-auth) esté corriendo. El frontend depende de la
# red externa `elineas-auth_default`, que solo existe una vez que ese stack se
# levantó al menos una vez — por eso el chequeo debe correr antes de
# `docker compose up`, no dentro del propio compose file.
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$FRONTEND_DIR/../elineas-auth"

if [ ! -d "$API_DIR" ]; then
	echo "No se encontró el proyecto de la API en $API_DIR" >&2
	exit 1
fi

cd "$API_DIR"
if [ -z "$(docker compose ps --status running --services 2>/dev/null | grep -x api || true)" ]; then
	echo "→ La API (elineas-auth) no está levantada. Iniciándola..."
	docker compose up -d
else
	echo "→ La API (elineas-auth) ya está levantada."
fi

cd "$FRONTEND_DIR"
docker compose up "$@"
