#!/bin/bash
#
# Abi-Shop – automatisches Update auf dem vServer
#
# Wird vom systemd-Timer abi-shop-update.timer regelmässig aufgerufen. Der Server holt
# sich neue Images selbst; GitHub braucht keinen Zugang zur Maschine. Das ist bewusst so
# gewählt: Ein Deploy-Schlüssel bei GitHub, der auf den vServer führt, wäre bei einem
# kompromittierten Account ein direkter Weg auf den Server.
#
# Ablauf: ziehen → nur bei echter Änderung migrieren und umschalten → aufräumen.
# Jeder Schritt ist idempotent; ein Lauf ohne neues Image tut nichts.

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/abi-shop}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$DEPLOY_DIR"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --profile migrate)

# Landet im Journal: journalctl -u abi-shop-update
log() { printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"; }

# Zwei gleichzeitige Läufe würden sich beim Umschalten in die Quere kommen.
exec 9>"$DEPLOY_DIR/.update.lock"
if ! flock -n 9; then
    log "Ein Update läuft bereits, dieser Lauf wird übersprungen."
    exit 0
fi

# "config --images <service>" liefert auch die Images der Abhängigkeiten, und zwar in
# wechselnder Reihenfolge. Das Datenbank-Image wird deshalb ausdrücklich herausgefiltert.
# (Nur anpassen, wenn in der Compose-Datei ein anderes Datenbank-Image steht.)
image_of_service() {
    "${COMPOSE[@]}" config --images "$1" | grep -v '^mysql:' | head -1
}

# Kennung des lokal vorliegenden Images. Solange sie sich nicht ändert, gibt es nichts zu tun.
image_id() { docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || echo 'keines'; }

image_app="$(image_of_service app)"
image_migrator="$(image_of_service migrate)"

before_app="$(image_id "$image_app")"
before_migrator="$(image_id "$image_migrator")"

if ! "${COMPOSE[@]}" pull --quiet; then
    log "FEHLER: Images konnten nicht geladen werden. Der laufende Betrieb bleibt unverändert."
    exit 1
fi

if [[ "$before_app" == "$(image_id "$image_app")" && "$before_migrator" == "$(image_id "$image_migrator")" ]]; then
    # Der Normalfall. Bewusst ohne Ausgabe, damit das Journal nicht alle paar Minuten
    # eine Zeile "nichts zu tun" bekommt.
    exit 0
fi

log "Neues Image gefunden: $image_app"

# Migrationen ausdrücklich zuerst – nicht über eine Startreihenfolge. Schlägt das fehl,
# wird NICHT umgeschaltet: Die bisherige Version läuft weiter, statt gegen ein halb
# migriertes Schema zu arbeiten.
log "Wende Datenbank-Migrationen an ..."
if ! "${COMPOSE[@]}" run --rm migrate; then
    log "FEHLER: Migration fehlgeschlagen. Es wird nicht umgeschaltet, die bisherige Version bleibt aktiv."
    exit 1
fi

log "Starte die Anwendung mit dem neuen Image ..."
"${COMPOSE[@]}" up -d --remove-orphans

# Warten, bis der Healthcheck greift. Der prüft auch die Datenbankverbindung.
status='unbekannt'
for _ in $(seq 1 40); do
    container="$("${COMPOSE[@]}" ps -q app || true)"
    [[ -n "$container" ]] || { sleep 3; continue; }

    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo 'unbekannt')"
    [[ "$status" == 'healthy' ]] && break
    [[ "$status" == 'unhealthy' ]] && break
    sleep 3
done

if [[ "$status" == 'healthy' ]]; then
    log "Update abgeschlossen. Container ist gesund."
else
    log "WARNUNG: Container meldet Status '$status'. Bitte nachsehen:"
    log "  docker compose -f $COMPOSE_FILE logs --tail=50 app"
fi

# Alte Images erst nach einer Woche entfernen – so bleibt ein Rollback möglich.
docker image prune -f --filter 'until=168h' >/dev/null 2>&1 || true
