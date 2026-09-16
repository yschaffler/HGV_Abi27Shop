#!/bin/sh
set -eu

# Startskript des Containers.
#
# Reihenfolge: erst Migrationen, dann Server. Startet der Server vor der Migration,
# laufen die ersten Anfragen gegen ein veraltetes Schema.

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Wende ausstehende Datenbank-Migrationen an ..."

  # Kurze Wartezeit auf die Datenbank. In docker compose startet MySQL zwar mit
  # Healthcheck vor der App, bei anderen Setups ist das nicht garantiert.
  attempt=1
  until node_modules/prisma/build/index.js migrate deploy; do
    if [ "$attempt" -ge "${MIGRATION_RETRIES:-10}" ]; then
      echo "Migrationen sind nach $attempt Versuchen fehlgeschlagen. Abbruch." >&2
      exit 1
    fi
    echo "Datenbank noch nicht erreichbar, neuer Versuch in 3 Sekunden ($attempt) ..."
    attempt=$((attempt + 1))
    sleep 3
  done

  echo "Migrationen sind aktuell."
else
  echo "RUN_MIGRATIONS=false – Migrationen werden uebersprungen."
fi

exec "$@"
