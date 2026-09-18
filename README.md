# Abi-Shop

Kleiner, sicherer Online-Shop für einen Abiturjahrgang. Der Ablauf ist bewusst genau einer:

```
Bestellen  →  Bezahlen  →  Sammelbestellung  →  Ausgabe in der Schule
```

Schüler bestellen Abipullis, Shirts, Zeitungen und Ähnliches, zahlen sofort online, und
nach Lieferung werden die Artikel an einem zentralen Ausgabepunkt verteilt. Es gibt keinen
Versand an Einzelpersonen und keine Schüler-Accounts.

Ausgelegt auf etwa 160–300 Bestellungen. Das läuft in einem einzigen Container.

---

## Inhalt

- [Was drin ist](#was-drin-ist)
- [Technik](#technik)
- [Schnellstart mit Docker](#schnellstart-mit-docker)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Environment Variables](#environment-variables)
- [Datenbank und Migrationen](#datenbank-und-migrationen)
- [Stripe einrichten](#stripe-einrichten)
- [Stripe-Webhooks](#stripe-webhooks)
- [E-Mail einrichten](#e-mail-einrichten)
- [Admin anlegen](#admin-anlegen)
- [Ausgabe am iPad](#ausgabe-am-ipad)
- [Tests](#tests)
- [Deployment](#deployment)
- [Fehlersuche](#fehlersuche)
- [Backups](#backups)
- [Monitoring und Logs](#monitoring-und-logs)
- [Vor dem Livegang](#vor-dem-livegang)

---

## Was drin ist

**Shop** – Produktübersicht, Produktdetails mit beliebigen Varianten (Farbe, Größe,
freie Bezeichnung), Warenkorb, Kasse, Bestellseite mit Statusanzeige, mobil optimiert.

**Zahlung** – Stripe Checkout. PayPal und weitere Zahlarten kommen automatisch dazu, sobald
sie im Stripe-Dashboard für das Konto freigeschaltet sind. Es werden keinerlei Zahlungsdaten
in dieser Anwendung gespeichert.

**Admin** – Bestellübersicht mit Suche und Filtern, Bestelldetails, Produkt- und
Variantenpflege inklusive Bild-Upload, Statistiken, Benutzerverwaltung, Protokoll,
Bestellzeitraum und Rechtstexte.

**Sammelbestellung** – automatische Aggregation aller bezahlten Positionen je Variante,
Export als CSV und XLSX, zusätzlich ein Detailexport je Bestellposition.

**Ausgabe** – eigene, für Touch ausgelegte Ansicht unter `/admin/distribution` mit
Namenssuche, Einzelausgabe, Teilausgabe und „Alles ausgeben“.

---

## Technik

| Bereich | Wahl |
|---|---|
| Framework | Next.js 16, App Router, React 19 |
| Sprache | TypeScript im `strict`-Modus |
| Datenbank | MySQL 8 über Prisma 7 |
| Styling | Tailwind CSS 4 |
| Validierung | Zod 4, ausnahmslos serverseitig |
| Zahlung | Stripe Checkout + Webhooks |
| Passwörter | Argon2id |
| Zweiter Faktor | TOTP (RFC 6238) |
| Tests | Vitest 5 |

Die Begründungen für die Architekturentscheidungen – auch für die Abweichungen vom
ursprünglichen Auftrag – stehen in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Die Sicherheitsmaßnahmen stehen in [`SECURITY.md`](SECURITY.md).

---

## Schnellstart mit Docker

Voraussetzung: Docker mit Compose-Plugin.

```bash
cp .env.example .env
$EDITOR .env                  # mindestens AUTH_SECRET, MYSQL_PASSWORD, APP_URL setzen
docker compose up -d --build
```

Der Container wendet ausstehende Migrationen beim Start selbst an und startet danach den
Server. Danach:

```bash
docker compose run --rm tools npm run db:seed        # optional: Beispielprodukte
docker compose run --rm -it tools npm run admin:create
```

Der Dienst `tools` nutzt das Builder-Stage des Images, in dem die Entwicklungswerkzeuge
liegen. Das Laufzeit-Image bleibt dadurch schlank, und `docker compose up` startet ihn
nicht mit.

Der Shop läuft dann auf `http://localhost:3000`, die Datenbank ist nur im Compose-Netz
erreichbar.

`AUTH_SECRET` erzeugen:

```bash
openssl rand -base64 48
```

> **HTTPS:** Der Container spricht selbst nur HTTP und bindet auf `127.0.0.1`. Davor gehört
> ein Reverse Proxy (Caddy, Traefik, nginx), der das Zertifikat verwaltet. Siehe
> [Deployment](#deployment).

---

## Lokale Entwicklung

```bash
npm install
cp .env.example .env          # DATABASE_URL und AUTH_SECRET ausfüllen
npm run db:migrate            # Schema anlegen
npm run db:seed               # Beispielprodukte
npm run admin:create          # ersten Admin anlegen
npm run dev
```

Eine Datenbank für die Entwicklung genügt über Docker:

```bash
docker compose up -d db
```

Nützliche Befehle:

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktionsbuild (erzeugt vorher den Prisma-Client) |
| `npm run typecheck` | TypeScript prüfen |
| `npm run lint` | ESLint |
| `npm test` | alle Tests |
| `npm run test:unit` | nur Tests ohne Datenbank |
| `npm run db:migrate` | Migration erzeugen und anwenden |
| `npm run db:deploy` | Migrationen anwenden (Produktion) |
| `npm run admin:create` | Admin- oder Ausgabe-Konto anlegen |

---

## Environment Variables

Alle Werte stehen mit Erklärung in [`.env.example`](.env.example). Sie werden beim ersten
Zugriff mit Zod geprüft; fehlt etwas, nennt die Fehlermeldung den betroffenen Namen – nie
den Wert.

Die wichtigsten:

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `DATABASE_URL` | immer | MySQL-Verbindung |
| `AUTH_SECRET` | immer | mind. 32 Zeichen, Basis für Sessions und 2FA-Verschlüsselung |
| `APP_URL` | immer | öffentliche Adresse, in Produktion mit `https://` |
| `STRIPE_SECRET_KEY` | Produktion | Stripe Secret Key |
| `STRIPE_WEBHOOK_SECRET` | Produktion | Signing Secret des Webhook-Endpunkts |
| `EMAIL_DRIVER` | Produktion | `resend` oder `smtp` (`console` ist in Produktion unzulässig) |
| `EMAIL_FROM` | bei echtem Versand | Absenderadresse |
| `TRUST_PROXY_HEADERS` | hinter Proxy | nur `true`, wenn ein vertrauenswürdiger Proxy davorsteht |

**Secrets gehören nie in den Code und nie ins Repository.** `.env*` ist in `.gitignore`.
Im Browser landet ausschließlich, was mit `NEXT_PUBLIC_` beginnt – solche Variablen gibt es
in diesem Projekt bewusst keine.

---

## Datenbank und Migrationen

Das Schema steht in [`prisma/schema.prisma`](prisma/schema.prisma). Alle Konsistenzregeln
liegen in der Datenbank, nicht nur im Anwendungscode: Fremdschlüssel, Unique-Constraints,
Indizes und passende Delete-Regeln.

```bash
npm run db:migrate            # Entwicklung: Migration erzeugen und anwenden
npm run db:deploy             # Produktion: vorhandene Migrationen anwenden
npm run db:generate           # Prisma-Client neu erzeugen
```

Zwei Eigenheiten, die bewusst so sind:

* `OrderItem.variantId` hat `onDelete: Restrict`. Eine Variante mit Bestellungen lässt sich
  nicht löschen, nur deaktivieren. Dadurch bleibt die Sammelbestellung dauerhaft auswertbar.
* `color` und `size` sind `NOT NULL DEFAULT ''`. MySQL behandelt `NULL` in Unique-Indizes als
  verschieden; mit Leerstring greift die Eindeutigkeit der Variantenkombination tatsächlich.

---

## Stripe einrichten

1. Konto auf [stripe.com](https://stripe.com) anlegen und verifizieren.
2. **Zahlarten** aktivieren: Dashboard → *Einstellungen → Zahlungsmethoden*. Karte ist
   üblicherweise aktiv; **PayPal** dort zusätzlich aktivieren, sofern für Land und Konto
   verfügbar. Der Shop übergibt bewusst keine feste Liste, damit genau die Methoden
   erscheinen, die freigeschaltet sind.
3. **API-Schlüssel** kopieren: Dashboard → *Entwickler → API-Schlüssel*.
   `STRIPE_SECRET_KEY` setzen. Testschlüssel beginnen mit `sk_test_`, Live mit `sk_live_`.
4. Vor dem Livegang mit Testschlüsseln durchspielen. Stripe stellt Testkarten bereit,
   z. B. `4242 4242 4242 4242` mit beliebigem zukünftigen Datum.

Der Betrag, der bei Stripe belastet wird, stammt immer aus der Datenbank – nie aus dem
Browser. Der Server lädt die Variante, nimmt ihren Preis, rechnet die Summe selbst und legt
den Preis als Snapshot in der Bestellposition ab.

---

## Stripe-Webhooks

**Ohne funktionierenden Webhook wird keine Bestellung jemals als bezahlt markiert.** Die
Rückleitung aus dem Browser zeigt nur an, sie entscheidet nichts.

### Produktion

Dashboard → *Entwickler → Webhooks → Endpunkt hinzufügen*:

* URL: `https://DEINE-DOMAIN/api/stripe/webhook`
* Events:
  * `checkout.session.completed`
  * `checkout.session.async_payment_succeeded`
  * `checkout.session.async_payment_failed`
  * `checkout.session.expired`
  * `payment_intent.payment_failed`
  * `charge.refunded`

Anschließend das **Signing Secret** (`whsec_…`) als `STRIPE_WEBHOOK_SECRET` eintragen.
Test- und Live-Modus haben unterschiedliche Secrets.

### Lokal testen

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

`stripe listen` gibt ein eigenes `whsec_…` aus, das lokal in die `.env` gehört.

### Was der Endpunkt garantiert

* Die Signatur wird geprüft, bevor irgendetwas passiert. Ohne gültige Signatur: `400`.
* Stripe stellt Events mindestens einmal zu, also durchaus mehrfach. Jede Event-ID wird als
  Primärschlüssel gespeichert – ein zweiter Zustellversuch läuft in den Unique-Constraint
  und bleibt wirkungslos.
* Statusübergänge sind als bedingte Updates formuliert (`PENDING → PAID`). Zwei gleichzeitig
  eintreffende Events können sich nicht überholen.
* Betrag und Währung müssen zur gespeicherten Bestellung passen. Weichen sie ab, wird nichts
  gebucht und der Vorgang laut geloggt.

---

## E-Mail einrichten

Nach bestätigter Zahlung geht automatisch eine Bestellbestätigung raus: Bestellnummer, Name,
Artikel mit Varianten und Mengen, Preise, Gesamtbetrag, Zahlungsstatus und der Hinweis zur
Ausgabe.

Drei Treiber stehen zur Wahl:

| `EMAIL_DRIVER` | Wofür |
|---|---|
| `console` | Entwicklung – die Mail landet nur im Serverlog. In Produktion abgelehnt. |
| `resend` | [Resend](https://resend.com), nur `RESEND_API_KEY` nötig |
| `smtp` | eigener Mailserver, etwa der der Schule |

In beiden echten Fällen muss die Absenderdomain beim Dienst verifiziert sein (SPF, DKIM),
sonst landen die Mails im Spam.

Ein fehlgeschlagener Mailversand rollt niemals eine Zahlung zurück – er wird geloggt, und
`confirmationEmailSentAt` verhindert doppelte Mails bei erneut zugestellten Webhooks.

---

## Admin anlegen

```bash
npm run admin:create
# oder mit Docker:
docker compose run --rm -it tools npm run admin:create
```

Das Skript fragt E-Mail, Name, Rolle und Passwort ab. Das Passwort wird nie als
Kommandozeilenargument entgegengenommen – es stünde sonst in der Shell-History und in der
Prozessliste.

Zwei Rollen:

* **ADMIN** – voller Zugriff. Beim ersten Login ist die Einrichtung eines zweiten Faktors
  Pflicht. Dabei werden acht einmalig nutzbare Notfallcodes angezeigt; sie lassen sich
  danach nicht erneut anzeigen.
* **DISTRIBUTION** – erreicht ausschließlich die Ausgabeansicht. Gedacht für Helfer, die am
  Ausgabetag das iPad bedienen. Ein zweiter Faktor ist hier möglich, aber nicht erzwungen.

---

## Ausgabe am iPad

`/admin/distribution` ist eine eigene, reduzierte Ansicht ohne Admin-Navigation.

1. Namen eintippen – Autocomplete ab zwei Zeichen, sucht in Vor- und Nachname sowie in der
   Bestellnummer.
2. Person antippen.
3. Artikel aushändigen und einzeln als ausgegeben markieren – oder alles auf einmal über
   **ALLES AUSGEBEN** mit vorheriger Rückfrage.
4. Nach vollständiger Ausgabe springt die Ansicht von selbst zurück zur Suche.

Gefunden werden ausschließlich **bezahlte** Bestellungen. Jede Position hat ihren eigenen
Status samt Zeitpunkt und ausgebender Person; Teilausgaben sind ausdrücklich vorgesehen.

Mehrere iPads gleichzeitig sind kein Problem: Die Ausgabe läuft über bedingte Updates. Wer
als Zweiter auf denselben Artikel tippt, bekommt den Hinweis „war bereits ausgegeben“ statt
einer zweiten Ausgabe.

---

## Tests

```bash
npm test                # alles
npm run test:unit       # nur ohne Datenbank
npm run test:integration
```

Zwei Projekte:

* **unit** – reine Logik: Preisberechnung, Mengengrenzen, Aggregation der Sammelbestellung,
  CSV-Escaping, Statusableitung, Tokens und Verschlüsselung, Rate Limiting, Origin-Prüfung.
* **integration** – gegen eine echte Datenbank: Bestellanlage mit Preis-Snapshot,
  Bestellzeitraum, Stripe-Webhook inklusive Signaturprüfung und Wiederholungen,
  Berechtigungen und die Ausgabe samt gleichzeitiger Zugriffe.

Die Integrationstests brauchen `TEST_DATABASE_URL` und weigern sich zu laufen, wenn der
Datenbankname nicht „test“ enthält – sie leeren diese Datenbank bei jedem Testfall.

---

## Deployment

**HTTPS** terminiert ein Reverse Proxy. Die App setzt HSTS und erwartet in Produktion, dass
`APP_URL` mit `https://` beginnt. Beispiel mit Caddy:

```caddyfile
abishop.example.de {
    reverse_proxy 127.0.0.1:3000
}
```

Mit einem Proxy davor gehört `TRUST_PROXY_HEADERS="true"` in die `.env`, damit das Rate
Limiting die echte Client-IP sieht. **Ohne** Proxy muss der Wert `false` bleiben – sonst
könnte jeder Client sein Limit über einen gefälschten Header umgehen.

Weitere Punkte:

* `docker compose up -d --build` nach jeder Änderung; Migrationen laufen beim Start mit.
* Der Container läuft als Nicht-Root und hat einen Healthcheck, der auch die Datenbank prüft.
* Produktbilder liegen im Volume `uploads`, die Datenbank in `db-data`.
* Nach dem Umschalten von Test- auf Live-Schlüssel den Webhook im Live-Modus neu anlegen –
  das Signing Secret ist ein anderes.

---

## Fehlersuche

### `exec /app/entrypoint.sh: no such file or directory`

Der Container startet nicht, obwohl die Datei existiert. Ursache sind fast immer
**CRLF-Zeilenenden**: Git für Windows wandelt mit der Voreinstellung
`core.autocrlf=true` beim Auschecken LF in CRLF um. Der Kernel liest den Shebang dann als
`/bin/sh\r`, findet diesen Interpreter nicht und meldet „no such file or directory" –
gemeint ist der Interpreter, nicht das Skript.

Das Projekt fängt das an zwei Stellen ab: `.gitattributes` erzwingt LF beim Auschecken, und
das Dockerfile entfernt zusätzlich eventuelle CR-Zeichen vor dem Start. Neu bauen genügt:

```bash
git pull
docker compose up -d --build
```

Falls es doch wieder auftritt, prüfen, was tatsächlich im Arbeitsverzeichnis liegt:

```bash
file docker/entrypoint.sh
# gut:     POSIX shell script, ... executable
# schlecht: ... with CRLF line terminators
```

Reparieren lässt es sich mit einem erzwungenen Neu-Auschecken:

```bash
git rm --cached -r .
git reset --hard
```

### Bestellungen bleiben auf „Zahlung ausstehend"

Der Stripe-Webhook kommt nicht an. Im Stripe-Dashboard unter *Entwickler → Webhooks* die
Zustellversuche ansehen. Häufigste Ursachen: falsche URL, das Signing Secret stammt aus dem
anderen Modus (Test statt Live), oder der Endpunkt ist von außen nicht erreichbar.

### `Konfiguration unvollständig oder ungültig`

Die Anwendung nennt beim Start die Namen der fehlenden oder ungültigen Variablen – niemals
deren Werte. Abgleichen mit [`.env.example`](.env.example).

---

## Backups

Ohne getestete Rücksicherung gibt es kein Backup. **Vor dem Livegang einmal
vollständig durchspielen.**

Sicherung:

```bash
docker compose exec -T db mysqldump \
  -u root -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --quick --default-character-set=utf8mb4 \
  abishop | gzip > backup-$(date +%F-%H%M).sql.gz
```

Rücksicherung:

```bash
gunzip -c backup-2026-10-04-2359.sql.gz | \
  docker compose exec -T db mysql -u root -p"$MYSQL_ROOT_PASSWORD" abishop
```

Produktbilder gehören mit gesichert:

```bash
docker run --rm -v abi-shop_uploads:/data -v "$PWD":/backup busybox \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

Empfehlung: täglich per Cron während der Bestellphase, Ablage auf einem **anderen** Rechner,
und die Dateien enthalten personenbezogene Daten – entsprechend geschützt aufbewahren und
nach der Ausgabe wieder löschen.

---

## Monitoring und Logs

Die Anwendung loggt strukturiert als JSON auf stdout. Feldnamen, die nach Geheimnis klingen
(Passwort, Token, Secret, Signatur, Cookie …), werden automatisch durch `[redacted]` ersetzt.

```bash
docker compose logs -f app
```

Nach außen bekommen Benutzer nie interne Details, sondern eine verständliche Meldung und
eine kurze Fehlerkennung. Mit dieser Kennung findet man den vollständigen Eintrag im Log.

Im Blick behalten:

* Healthcheck des Containers (`docker compose ps`)
* Zustellquote der Webhooks im Stripe-Dashboard
* Zustellquote der Mails beim Mailanbieter
* Bestellungen, die dauerhaft auf `PENDING` stehen – typisches Zeichen für einen Webhook,
  der nicht ankommt
* Einträge mit `"status":"mismatch"` – Betrag oder Session passten nicht zur Bestellung

---

## Vor dem Livegang

Die technische Checkliste steht in [`SECURITY.md`](SECURITY.md), die rechtliche in
[`LEGAL_CHECKLIST.md`](LEGAL_CHECKLIST.md). Beide gehören abgearbeitet, bevor der Shop
für den Jahrgang freigegeben wird.
