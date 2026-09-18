# Deployment auf dem vServer

Anleitung für `abi.yschaffler.de` auf einem eigenen Server mit nginx.

**Aufbau**

```
GitHub: Push auf den Hauptzweig
   │
   ├─ Workflow: Lint, Typen, 160 Tests gegen echtes MySQL 8
   │             (schlägt etwas fehl, entsteht kein Image)
   │
   └─ zwei Images nach ghcr.io
            │
            ▼
   vServer: systemd-Timer, alle 5 Minuten
            │  neues Image?  nein → fertig, nichts passiert
            │                ja   ↓
            │  Migrationen anwenden  ── schlägt fehl → alte Version läuft weiter
            │                ↓
            │  Container umschalten
            ▼
   nginx (TLS) ──► 127.0.0.1:3000
```

**Warum der Server selbst zieht, statt dass GitHub deployt:** Ein Deploy-Schlüssel bei
GitHub, der auf den vServer führt, wäre bei einem kompromittierten GitHub-Account ein
direkter Weg auf die Maschine. Beim Pull-Modell braucht GitHub keinerlei Zugang zum
Server, und es muss kein SSH-Port für fremde IP-Bereiche offen sein.

---

## Inhalt

- [Voraussetzungen](#voraussetzungen)
- [1. Server vorbereiten](#1-server-vorbereiten)
- [2. Projekt ablegen](#2-projekt-ablegen)
- [3. Zugang zur Registry](#3-zugang-zur-registry)
- [4. Konfiguration eintragen](#4-konfiguration-eintragen)
- [5. Erstes Deployment](#5-erstes-deployment)
- [6. nginx und TLS](#6-nginx-und-tls)
- [7. Automatische Updates aktivieren](#7-automatische-updates-aktivieren)
- [8. Admin anlegen](#8-admin-anlegen)
- [9. Stripe-Webhook eintragen](#9-stripe-webhook-eintragen)
- [10. Backups einrichten](#10-backups-einrichten)
- [Betrieb](#betrieb)
- [Rollback](#rollback)
- [Fehlersuche](#fehlersuche)

---

## Voraussetzungen

* vServer mit Debian 12 oder Ubuntu 22.04/24.04, root-Zugang
* Ein A-Record (und möglichst AAAA) für `abi.yschaffler.de` auf die Server-IP
* Ports 80 und 443 offen
* Das Repository liegt auf GitHub unter `yschaffler/HGV_Abi27Shop`

Prüfen, ob die DNS-Auflösung schon steht:

```bash
dig +short abi.yschaffler.de
```

Solange hier nichts oder die falsche IP steht, kann certbot kein Zertifikat ausstellen.

---

## 1. Server vorbereiten

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg nginx certbot git

# Docker aus dem offiziellen Repository (die Paketquellen der Distribution sind veraltet)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Damit die Container einen Neustart des Servers überleben
systemctl enable --now docker
```

> Bei Ubuntu in den beiden `curl`/`echo`-Zeilen `debian` durch `ubuntu` ersetzen.

Kurz prüfen:

```bash
docker --version && docker compose version
```

---

## 2. Projekt ablegen

Auf dem Server wird nichts gebaut – gebraucht werden nur die Compose-Datei und die
Skripte aus `deploy/`.

```bash
git clone https://github.com/yschaffler/HGV_Abi27Shop.git /opt/abi-shop
cd /opt/abi-shop
```

Später aktualisieren sich diese Dateien mit:

```bash
cd /opt/abi-shop && git pull
```

> Das ist unabhängig vom Anwendungs-Update. Die Anwendung selbst kommt als fertiges
> Image; `git pull` auf dem Server ist nur nötig, wenn sich die Compose-Datei, das
> Update-Skript oder die nginx-Konfiguration geändert haben.

---

## 3. Zugang zur Registry

Ist das GitHub-Repository **öffentlich**, sind auch die Images öffentlich und dieser
Schritt entfällt.

Bei einem **privaten** Repository braucht der Server einen Lesezugang:

1. Auf GitHub: *Settings → Developer settings → Personal access tokens → Tokens (classic)*
2. Neues Token mit **ausschließlich** dem Recht `read:packages`
3. Auf dem Server anmelden:

```bash
echo 'DAS_TOKEN' | docker login ghcr.io -u yschaffler --password-stdin
```

Die Anmeldung landet in `/root/.docker/config.json` und überlebt Neustarts.

> Bewusst nur `read:packages`: Selbst wenn jemand den Server übernimmt, taugt das Token
> nicht zum Verändern von Code oder Images.

Nach dem allerersten Workflow-Lauf müssen die Pakete einmalig sichtbar gemacht oder dem
Repository zugeordnet werden: GitHub → Profil → *Packages* → `abi-shop` → *Package
settings*. Dort entweder auf *Public* stellen oder unter *Manage Actions access* das
Repository eintragen.

---

## 4. Konfiguration eintragen

```bash
cd /opt/abi-shop
install -m 600 deploy/env.production.example .env
nano .env
```

Mindestens auszufüllen:

| Wert | Wie |
|---|---|
| `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` | `openssl rand -base64 30` |
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `APP_URL` | `https://abi.yschaffler.de` |
| `STRIPE_SECRET_KEY` | aus dem Stripe-Dashboard |
| `STRIPE_WEBHOOK_SECRET` | kommt in Schritt 9 |
| `EMAIL_*` | Zugangsdaten des Mailversands |

> **`AUTH_SECRET` einmal setzen und sicher aufbewahren.** Wird der Wert später geändert,
> sind alle Sessions ungültig *und* die gespeicherten 2FA-Secrets nicht mehr
> entschlüsselbar – jeder Admin müsste den zweiten Faktor neu einrichten.

Rechte kontrollieren:

```bash
ls -l .env      # muss -rw------- sein
```

---

## 5. Erstes Deployment

Voraussetzung: Der Workflow ist mindestens einmal durchgelaufen und hat Images
veröffentlicht (auf GitHub unter *Actions* nachsehen).

```bash
cd /opt/abi-shop
docker compose -f docker-compose.prod.yml --profile migrate pull
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

Prüfen:

```bash
docker compose -f docker-compose.prod.yml ps
curl -s localhost:3000/api/health      # erwartet: {"status":"ok"}
```

Meldet der Healthcheck etwas anderes, stimmt meistens die Datenbankverbindung nicht –
siehe [Fehlersuche](#fehlersuche).

---

## 6. nginx und TLS

nginx startet nicht, wenn eine Konfiguration auf ein Zertifikat verweist, das es noch
nicht gibt. Deshalb in zwei Schritten.

**Erst HTTP, um das Zertifikat zu holen:**

```bash
mkdir -p /var/www/certbot
cp /opt/abi-shop/deploy/nginx/map-upgrade.conf /etc/nginx/conf.d/
cp /opt/abi-shop/deploy/nginx/abi.yschaffler.de.http-only.conf \
   /etc/nginx/sites-available/abi.yschaffler.de.conf
ln -sf ../sites-available/abi.yschaffler.de.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot certonly --webroot -w /var/www/certbot \
  -d abi.yschaffler.de \
  --email DEINE@EMAIL.DE --agree-tos --no-eff-email
```

**Dann die vollständige Konfiguration:**

```bash
cp /opt/abi-shop/deploy/nginx/abi.yschaffler.de.conf \
   /etc/nginx/sites-available/abi.yschaffler.de.conf
nginx -t && systemctl reload nginx
```

Erneuerung läuft über den certbot-Timer von selbst. Kontrollieren:

```bash
systemctl status certbot.timer
certbot renew --dry-run
```

Danach ist der Shop unter `https://abi.yschaffler.de` erreichbar.

### Was in der nginx-Konfiguration wichtig ist

Zwei Punkte sind nicht optional:

* **`proxy_set_header Host $host;`** – Next.js vergleicht bei Server Actions den Origin
  gegen den Host, und die Anwendung prüft das zusätzlich selbst. Fehlt der korrekte
  Host, schlägt jede Bestellung und jede Admin-Aktion mit einer Origin-Fehlermeldung fehl.
* **`proxy_set_header X-Forwarded-For $remote_addr;`** – bewusst *ersetzen* statt
  anhängen. Das übliche `$proxy_add_x_forwarded_for` hängt die echte IP an einen vom
  Client mitgeschickten Header an; die Anwendung wertet den ersten Eintrag aus, und ein
  Angreifer könnte dort eine beliebige IP hineinschreiben und sein Rate Limit umgehen.

Außerdem gesetzt: `client_max_body_size 4m`, sonst quittiert nginx den Bild-Upload im
Adminbereich mit 413.

Sicherheits-Header (CSP mit Nonce, HSTS, nosniff) setzt die Anwendung selbst. nginx setzt
sie bewusst **nicht** zusätzlich – zwei CSP-Header bedeuten, dass beide gelten, und die
Seite bricht, sobald sich die Anwendungs-CSP ändert.

---

## 7. Automatische Updates aktivieren

```bash
cp /opt/abi-shop/deploy/systemd/abi-shop-update.* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now abi-shop-update.timer
```

Kontrollieren:

```bash
systemctl list-timers abi-shop-update.timer
journalctl -u abi-shop-update -n 30
```

Ab jetzt gilt: Push auf den Hauptzweig → Tests laufen → Images entstehen → der Server
zieht sie binnen fünf Minuten, migriert und schaltet um.

Ein Lauf ohne neues Image tut nichts und schreibt nichts ins Journal. Zu sehen ist also
nur, wenn tatsächlich deployt wurde.

Von Hand anstoßen, ohne auf den Timer zu warten:

```bash
systemctl start abi-shop-update
journalctl -u abi-shop-update -f
```

### Wie das Update abgesichert ist

* **Migration zuerst, dann umschalten.** Schlägt die Migration fehl, wird *nicht*
  umgeschaltet – die bisherige Version läuft weiter, statt gegen ein halb migriertes
  Schema zu arbeiten.
* **Kein Image, kein Risiko.** Ist der Pull fehlgeschlagen, bricht das Skript ab, ohne
  irgendetwas anzufassen.
* **Ein Lauf gleichzeitig.** Eine Sperrdatei verhindert, dass sich zwei Läufe beim
  Umschalten überschneiden.
* **Alte Images bleiben eine Woche liegen**, damit ein Rollback möglich ist.

---

## 8. Admin anlegen

Das Laufzeit-Image enthält bewusst keine Entwicklungswerkzeuge. Für einmalige Aufgaben
wie das Anlegen des ersten Admins wird deshalb kurz das Werkzeug-Image gebaut:

```bash
cd /opt/abi-shop
docker build --target builder -t abi-shop-tools .

docker run --rm -it --network abi-shop_default \
  --env-file <(grep -E '^(MYSQL_|AUTH_SECRET|APP_URL)' .env) \
  -e DATABASE_URL="mysql://abishop:$(grep '^MYSQL_PASSWORD=' .env | cut -d= -f2- | tr -d '\"')@db:3306/abishop" \
  abi-shop-tools npm run admin:create
```

> Der Netzwerkname ergibt sich aus dem Verzeichnisnamen: `/opt/abi-shop` → `abi-shop_default`.
> Kontrollieren mit `docker network ls`.

Das Skript fragt E-Mail, Name, Rolle und Passwort ab. Das Passwort wird nie als
Argument entgegengenommen – es stünde sonst in der History und in der Prozessliste.

Beim ersten Login unter `https://abi.yschaffler.de/login` richtet ein ADMIN-Konto
zwingend den zweiten Faktor ein. **Die dort angezeigten acht Notfallcodes abschreiben** –
sie lassen sich danach nicht erneut anzeigen.

Anschließend unter *Admin → Einstellungen* ausfüllen: Shopname, Kontaktadresse,
Bestellzeitraum, Abholhinweis und die Rechtstexte. Solange dort Platzhalter stehen, zeigt
das Dashboard eine Warnung – siehe `LEGAL_CHECKLIST.md`.

---

## 9. Stripe-Webhook eintragen

Ohne funktionierenden Webhook wird **keine Bestellung jemals als bezahlt markiert**.

Im Stripe-Dashboard → *Entwickler → Webhooks → Endpunkt hinzufügen*:

* URL: `https://abi.yschaffler.de/api/stripe/webhook`
* Events:
  * `checkout.session.completed`
  * `checkout.session.async_payment_succeeded`
  * `checkout.session.async_payment_failed`
  * `checkout.session.expired`
  * `payment_intent.payment_failed`
  * `charge.refunded`

Das angezeigte Signing Secret (`whsec_…`) in die `.env` als `STRIPE_WEBHOOK_SECRET`
eintragen, dann:

```bash
cd /opt/abi-shop
docker compose -f docker-compose.prod.yml up -d
```

Testen lässt sich das direkt im Stripe-Dashboard über *Send test webhook*. Erwartet wird
HTTP 200. Kommt 400, passt das Secret nicht.

---

## 10. Backups einrichten

**Ohne getestete Rücksicherung gibt es kein Backup.** Einmal vollständig durchspielen,
bevor der Shop für den Jahrgang freigegeben wird.

```bash
mkdir -p /var/backups/abi-shop
cat > /usr/local/bin/abi-shop-backup.sh <<'SCRIPT'
#!/bin/bash
set -euo pipefail
cd /opt/abi-shop
set -a; . ./.env; set +a

stamp="$(date +%F-%H%M)"
target="/var/backups/abi-shop"

docker compose -f docker-compose.prod.yml exec -T db \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --quick --default-character-set=utf8mb4 \
  "$MYSQL_DATABASE" | gzip > "$target/db-$stamp.sql.gz"

docker run --rm -v abi-shop_uploads:/data -v "$target":/backup busybox \
  tar czf "/backup/uploads-$stamp.tar.gz" -C /data .

# Vier Wochen aufheben – Bestelldaten sind personenbezogen, also nicht ewig.
find "$target" -name '*.gz' -mtime +28 -delete
SCRIPT
chmod +x /usr/local/bin/abi-shop-backup.sh

# Täglich um 3:30 Uhr
( crontab -l 2>/dev/null; echo '30 3 * * * /usr/local/bin/abi-shop-backup.sh' ) | crontab -
```

Rücksicherung:

```bash
cd /opt/abi-shop
set -a; . ./.env; set +a
gunzip -c /var/backups/abi-shop/db-2026-10-04-0330.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"
```

> Die Sicherungen enthalten Namen und E-Mail-Adressen des gesamten Jahrgangs. Sie gehören
> auf einen **anderen** Rechner kopiert, geschützt aufbewahrt und nach der Ausgabe
> gelöscht – siehe `LEGAL_CHECKLIST.md`.

---

## Betrieb

```bash
cd /opt/abi-shop

# Zustand
docker compose -f docker-compose.prod.yml ps
curl -s localhost:3000/api/health

# Logs der Anwendung (strukturiertes JSON, Geheimnisse sind maskiert)
docker compose -f docker-compose.prod.yml logs -f app

# Verlauf der Deployments
journalctl -u abi-shop-update -n 50

# nginx
tail -f /var/log/nginx/abi-shop.error.log
```

Im Blick behalten:

* Bestellungen, die dauerhaft auf `PENDING` stehen → der Webhook kommt nicht an
* Logzeilen mit `"status":"mismatch"` → Betrag oder Session passten nicht zur Bestellung
* Zustellquote der Webhooks im Stripe-Dashboard und der Mails beim Mailanbieter
* Plattenplatz: `df -h`

---

## Rollback

Jedes Image ist zusätzlich mit seinem Commit getaggt (`sha-a1b2c3d`). Zurück auf eine
frühere Version:

```bash
cd /opt/abi-shop
nano .env                       # IMAGE_TAG="sha-a1b2c3d"
docker compose -f docker-compose.prod.yml --profile migrate pull
docker compose -f docker-compose.prod.yml up -d
```

Solange `IMAGE_TAG` nicht auf `latest` steht, lässt der Timer die Version in Ruhe: Das
Skript zieht dann immer denselben Tag und stellt keine Änderung fest.

> **Achtung bei Migrationen.** Datenbank-Migrationen laufen nur vorwärts. Wurde mit der
> neuen Version bereits migriert, passt eine ältere Anwendung unter Umständen nicht mehr
> zum Schema. Ein Rollback über eine Migration hinweg braucht deshalb die Rücksicherung
> eines Backups.

---

## Fehlersuche

### Der Timer deployt nicht

```bash
systemctl status abi-shop-update.timer
journalctl -u abi-shop-update -n 50
```

Häufig: Die Registry lehnt den Zugriff ab, weil das Paket privat ist und der Server nicht
angemeldet ist → siehe [Schritt 3](#3-zugang-zur-registry). Prüfen mit:

```bash
docker pull ghcr.io/yschaffler/abi-shop:latest
```

### 502 Bad Gateway

Der Container läuft nicht oder ist nicht gesund.

```bash
docker compose -f /opt/abi-shop/docker-compose.prod.yml ps
docker compose -f /opt/abi-shop/docker-compose.prod.yml logs --tail=50 app
```

### Bestellen oder Admin-Aktionen scheitern mit einem Origin-Hinweis

nginx reicht den Host nicht korrekt weiter. In der vHost-Konfiguration müssen
`proxy_set_header Host $host;` und `X-Forwarded-Host` gesetzt sein, und `APP_URL` in der
`.env` muss exakt `https://abi.yschaffler.de` lauten – ohne abschließenden Schrägstrich.

### Bild-Upload bricht mit 413 ab

`client_max_body_size` in der nginx-Konfiguration fehlt oder ist zu klein.

### Die Anwendung startet nicht

```bash
docker compose -f /opt/abi-shop/docker-compose.prod.yml logs app | head -30
```

Bei `Konfiguration unvollständig oder ungültig` nennt die Meldung die Namen der fehlenden
Variablen – niemals deren Werte. Mit `deploy/env.production.example` abgleichen.

Zwei Stolpersteine, die die Anwendung absichtlich hart ablehnt:

* `APP_URL` muss in Produktion mit `https://` beginnen.
* `EMAIL_DRIVER="console"` ist in Produktion unzulässig – das würde bedeuten, dass
  Bestellbestätigungen nur im Log landen.
