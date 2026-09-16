# Abi-Shop – Architektur, Datenmodell und Sicherheitskonzept

Stand: Phase 1. Dieses Dokument ist die verbindliche Grundlage für die Implementierung.
Es beschreibt **was** gebaut wird und **warum** – inklusive der Stellen, an denen bewusst
vom Auftrag abgewichen wird.

---

## 1. Leitplanken

Der Shop bildet genau einen Workflow ab:

```
Bestellen → Bezahlen → Sammelbestellung → Ausgabe
```

Alles, was diesen Workflow nicht unterstützt, wird nicht gebaut. Konkret **nicht** enthalten:
Kundenkonten für Schüler, Versandlogik, Lagerbestandsführung, Rabattcodes, Mehrwährungs-
oder Mehrsprachfähigkeit, Retourenprozess im System, Suchindex, Microservices, Message Queue.

Dimensionierung: ca. 160–300 Bestellungen, ein einziger Bestellzeitraum pro Jahrgang,
Lastspitze am Bestellschluss. Das läuft problemlos in **einem** Docker-Container mit einer
MySQL-Datenbank.

---

## 2. Technischer Stack

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Framework | Next.js 16, App Router | wie beauftragt; Server Components + Server Actions halten Logik serverseitig |
| Sprache | TypeScript, `strict: true` | wie beauftragt |
| ORM/DB | Prisma 7 + MySQL 8 | wie beauftragt |
| Styling | Tailwind CSS 4 | wie beauftragt |
| Validierung | Zod 4 | wie beauftragt |
| Zahlung | Stripe Checkout (hosted) + Webhooks | wie beauftragt; keine Zahlungsdaten im System |
| Tests | Vitest 5 | schnell, natives ESM/TS, kein zusätzlicher Build |
| Excel-Export | ExcelJS | siehe Abweichung 4 |
| Passwörter | Argon2id (`@node-rs/argon2`) | OWASP-Empfehlung |
| 2FA | TOTP nach RFC 6238 (`otplib`) | Standard, funktioniert mit jeder Authenticator-App |

### Begründete Abweichungen vom Auftrag

**1. Authentifizierung ohne Auth.js/NextAuth.**
Der Auftrag fordert sichere Admin-Authentifizierung mit MFA. Auth.js in der aktuellen Version
bräuchte einen Credentials-Provider (dort ausdrücklich als Sonderweg dokumentiert), JWT-Sessions
und einen aufgesetzten zweiten Faktor – das ist für **zwei bis fünf Admin-Accounts** mehr
Komplexität und mehr Angriffsfläche als Nutzen. Stattdessen: **serverseitige, in der Datenbank
gespeicherte Sessions** mit opaken Zufallstokens. Das ist kein Eigenbau-Krypto, sondern das
Standardmuster:

* Token = 32 Byte aus `crypto.randomBytes` (256 Bit Entropie), base64url-kodiert.
* In der Datenbank liegt nur der **SHA-256-Hash** des Tokens → DB-Leak ergibt keine gültigen Sessions.
* Cookie: `httpOnly`, `secure`, `sameSite=lax`, `path=/`, feste Lebensdauer.
* Passwort-Hash: **Argon2id** mit OWASP-Parametern.
* Zweiter Faktor: **TOTP (RFC 6238)** über `otplib`, TOTP-Secret **AES-256-GCM-verschlüsselt** at rest.
* Recovery-Codes: einmalig nutzbar, Argon2-gehasht gespeichert.

Es wird an keiner Stelle eigene Kryptographie implementiert – ausschließlich `node:crypto`
und etablierte Bibliotheken.

**2. Produkt-URLs über Slug statt numerischer ID.**
Auftrag: `/produkte/[id]`. Umgesetzt: `/produkte/[slug]`, z. B. `/produkte/abipulli-2027`.
Produkte sind öffentlich, hier gibt es kein IDOR-Risiko; sprechende URLs sind besser teilbar.
Für **Bestellungen** gilt das Gegenteil und dort wird strikt mit Zufallstokens gearbeitet (Abschnitt 7).

**3. Warenkorb im Browser (`localStorage`), Preise ausschließlich vom Server.**
Der Warenkorb speichert nur `{variantId, quantity}` – niemals Preise. Jede Preisberechnung,
jede Anzeige eines Gesamtbetrags und der Checkout laden die Preise frisch aus der Datenbank.
Ein manipulierter `localStorage` kann damit nur bewirken, dass jemand seinen eigenen Warenkorb
kaputt macht.

**4. ExcelJS statt SheetJS/`xlsx`.**
Das `xlsx`-Paket auf npm ist nicht der offiziell gepflegte Distributionskanal von SheetJS und
war mehrfach Gegenstand von Sicherheitsmeldungen. ExcelJS ist über npm gepflegt und deckt
unseren Bedarf (eine Tabelle, Kopfzeile, Spaltenbreiten) vollständig ab.

**5. CSV-Export selbst erzeugt.**
RFC-4180-Escaping ist wenige Zeilen Code und gut testbar; wichtiger ist der **Schutz vor
CSV-Injection**: Werte, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnen, werden mit einem
Apostroph maskiert, damit Excel sie nicht als Formel ausführt. Eine Fremdbibliothek macht das
nicht automatisch.

**6. Geldbeträge als Integer-Cent.**
Keine Floats, kein `Decimal`-Handling im Frontend. `3990` = 39,90 €. Stripe erwartet ohnehin Cent.

---

## 3. Ordnerstruktur

```
.
├── docs/ARCHITECTURE.md
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── scripts/
│   └── create-admin.ts            # interaktives Anlegen des ersten Admins
├── src/
│   ├── proxy.ts                   # Security-Header, CSP-Nonce, Admin-Gate (Next 16 Proxy/Middleware)
│   ├── app/
│   │   ├── (shop)/                # öffentlicher Bereich
│   │   │   ├── page.tsx                      # Produktübersicht
│   │   │   ├── produkte/[slug]/page.tsx
│   │   │   ├── warenkorb/page.tsx
│   │   │   ├── checkout/page.tsx
│   │   │   ├── bestellung/[token]/page.tsx
│   │   │   └── rechtliches/[doc]/page.tsx    # Impressum, Datenschutz, Widerruf, AGB
│   │   ├── login/                 # Admin-Login inkl. 2FA-Schritt
│   │   ├── admin/
│   │   │   ├── layout.tsx         # serverseitiger Rollen-Gate
│   │   │   ├── page.tsx           # Dashboard
│   │   │   ├── orders/            # Liste + Detail
│   │   │   ├── products/          # Produkte + Varianten
│   │   │   ├── statistics/
│   │   │   ├── export/
│   │   │   ├── settings/
│   │   │   ├── users/
│   │   │   ├── audit/
│   │   │   └── distribution/      # iPad-Ausgabe (eigenes, reduziertes Layout)
│   │   └── api/
│   │       ├── stripe/webhook/route.ts
│   │       ├── distribution/search/route.ts
│   │       ├── admin/export/route.ts
│   │       ├── media/[id]/route.ts
│   │       └── health/route.ts
│   ├── components/                # wiederverwendbare UI-Bausteine
│   ├── server/                    # ausschließlich serverseitig ("server-only")
│   │   ├── auth/                  # password, session, totp, rbac, login
│   │   ├── shop/                  # pricing, order, cart-resolution, order-window
│   │   ├── stripe/                # client, checkout, webhook-handler
│   │   ├── mail/                  # driver (resend|smtp|console), templates
│   │   ├── export/                # csv, xlsx, aggregation
│   │   ├── audit.ts
│   │   ├── db.ts
│   │   └── settings.ts
│   ├── lib/                       # isomorph, ohne Secrets
│   │   ├── money.ts, cart.ts (client), validation/ (Zod-Schemas), rate-limit.ts
│   └── styles/
└── tests/                         # Vitest
```

**Trennregel:** Alles unter `src/server/` importiert `server-only` und darf niemals in eine
Client-Komponente gelangen. Client-Komponenten sind explizit mit `"use client"` markiert und
enthalten ausschließlich UI-Logik.

---

## 4. Datenmodell (Prisma)

Enums:

```prisma
enum Role                    { ADMIN  DISTRIBUTION }
enum PaymentStatus           { PENDING  PAID  FAILED  REFUNDED  CANCELLED }
enum FulfillmentStatus       { NEW  ORDERED  ARRIVED }            // Stand der Sammelbestellung
enum ItemDistributionStatus  { NOT_DISTRIBUTED  DISTRIBUTED }
enum OrderDistributionStatus { NOT_DISTRIBUTED  PARTIALLY_DISTRIBUTED  FULLY_DISTRIBUTED }
```

| Modell | Zweck | Wichtigste Felder / Regeln |
|---|---|---|
| `User` | Admin- und Ausgabe-Accounts | `email @unique`, `passwordHash`, `role`, `totpSecret` (AES-GCM), `failedLoginAttempts`, `lockedUntil`, `isActive` |
| `RecoveryCode` | 2FA-Notfallcodes | Argon2-Hash, `usedAt`, Cascade zum User |
| `Session` | serverseitige Sessions | PK = SHA-256 des Tokens, `expiresAt`, `lastUsedAt`, Cascade zum User |
| `Product` | Artikel | `slug @unique`, `active`, `sortOrder`, optionales Bild |
| `ProductVariant` | Farbe/Größe/Preis | `priceCents Int`, `@@unique([productId, color, size])`, `active` |
| `Order` | Bestellung | `orderNumber @unique`, `publicToken @unique`, Name/E-Mail/Klasse, `totalCents`, `paymentStatus`, `fulfillmentStatus`, `distributionStatus`, Stripe-IDs `@unique` |
| `OrderItem` | Position mit Preis-Snapshot | `unitPriceCents`, `quantity`, `lineTotalCents`, `distributionStatus`, `distributedAt`, `distributedByUserId` |
| `Settings` | Singleton (id=1) | Bestellzeitraum, Abholhinweis, Kontakt, Rechtstexte |
| `AuditLog` | kritische Admin-Aktionen | Akteur, Aktion, Entität, `summary` („NEW → ORDERED“) |
| `StripeWebhookEvent` | Idempotenz | PK = Stripe-`evt_…`-ID |
| `MediaAsset` | Produktbilder | Dateiname auf Volume, MIME, Größe |

**Konsistenzregeln**

* `color`/`size` sind `NOT NULL DEFAULT ''` – MySQL behandelt `NULL` in Unique-Indizes als
  verschieden; mit Leerstring greift `@@unique([productId, color, size])` tatsächlich.
* `OrderItem.variantId` → `onDelete: Restrict`. Eine Variante mit Bestellungen lässt sich
  nicht löschen, nur deaktivieren. Damit bleibt die Sammelbestellung dauerhaft auswertbar.
* Preise stehen in `OrderItem` als Snapshot. Eine spätere Preisänderung verändert bezahlte
  Bestellungen nicht.
* `Order.distributionStatus` ist denormalisiert, wird aber **ausschließlich innerhalb derselben
  Transaktion** wie die Positionsänderung neu berechnet → kann nicht auseinanderlaufen, ist
  aber filterbar.
* Indizes: `Order(lastName, firstName)` für die Ausgabesuche, `Order(paymentStatus, createdAt)`,
  `Order(className)`, `OrderItem(orderId)`, `OrderItem(variantId)` für die Aggregation.

---

## 5. Seiten und Endpunkte

### Öffentlich

| Route | Inhalt |
|---|---|
| `/` | Produktübersicht, Status des Bestellzeitraums |
| `/produkte/[slug]` | Produktdetail, Variantenauswahl, in den Warenkorb |
| `/warenkorb` | Positionen, serverseitig neu bepreist |
| `/checkout` | Vorname, Nachname, E-Mail, Klasse → Stripe |
| `/bestellung/[token]` | Bestellstatus über Zufallstoken |
| `/rechtliches/[doc]` | Impressum, Datenschutz, Widerruf, AGB |

### Mutationen: Server Actions statt REST

Alle Zustandsänderungen aus der eigenen Oberfläche laufen über **Server Actions**. Next.js
prüft dort von sich aus `Origin`/`Host` – damit ist CSRF für den gesamten Schreibpfad
abgedeckt, ohne ein eigenes Token-Schema zu bauen. Jede Action beginnt mit
Rate-Limit-Prüfung → Zod-Validierung → Autorisierung.

| Action | Rolle | Aufgabe |
|---|---|---|
| `createCheckoutSession` | öffentlich | Bestellzeitraum prüfen, Preise laden, Order + Items in einer Transaktion, Stripe-Session erzeugen |
| `distributeItem` / `distributeAllItems` | ADMIN, DISTRIBUTION | Ausgabe markieren, Bestellstatus neu berechnen |
| `saveProduct` / `saveVariant` / `toggleActive` | ADMIN | Produktpflege |
| `updateSettings` | ADMIN | Bestellzeitraum, Texte |
| `setPaymentStatus` / `setFulfillmentStatus` | ADMIN | Statuskorrektur, immer mit Audit-Log |
| `createUser` / `resetTotp` / `deactivateUser` | ADMIN | Benutzerverwaltung |
| `login` / `verifyTotp` / `logout` | öffentlich / eingeloggt | Anmeldung |

### Route Handler (nur wo wirklich nötig)

| Route | Methode | Schutz |
|---|---|---|
| `/api/stripe/webhook` | POST | Stripe-Signatur, Raw-Body, idempotent |
| `/api/distribution/search?q=` | GET | Session + Rolle ADMIN/DISTRIBUTION, Rate Limit, min. 2 Zeichen |
| `/api/admin/export` | GET | Session + Rolle ADMIN, liefert CSV/XLSX als Download |
| `/api/media/[id]` | GET | öffentlich, fester Content-Type, `Content-Disposition: inline` + `nosniff` |
| `/api/health` | GET | Liveness für Docker/Monitoring, gibt keine internen Details preis |

---

## 6. Zahlungsfluss

```
Kunde: /checkout  (Name, E-Mail, Klasse, Warenkorb = nur IDs + Mengen)
   │
   ├─► Server Action
   │      1. Rate Limit (IP + E-Mail)
   │      2. Zod-Validierung
   │      3. Bestellzeitraum serverseitig prüfen  ── außerhalb ⇒ Abbruch
   │      4. Varianten aus DB laden (aktiv? Produkt aktiv?)
   │      5. Preise aus DB, Summe serverseitig
   │      6. TRANSAKTION: Order (PENDING) + OrderItems mit Preis-Snapshot
   │      7. Stripe Checkout Session aus DB-Preisen, metadata.orderId
   │      8. stripeCheckoutSessionId an Order speichern
   │
   ├─► Redirect zu checkout.stripe.com   (Karte, PayPal, weitere – je nach Stripe-Konto)
   │
   ├─► success_url  → /bestellung/[token]?status=verarbeitung
   │      zeigt nur an: „Zahlung wird bestätigt“ – setzt NIEMALS PAID
   │
   └─► Stripe Webhook  POST /api/stripe/webhook
          1. Raw-Body lesen (kein JSON-Parsing vorher)
          2. stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
          3. Event-ID in StripeWebhookEvent INSERTen → Unique-Verstoß = Replay ⇒ 200, Ende
          4. TRANSAKTION: Order nur PENDING → PAID (bedingtes updateMany)
          5. Bestätigungsmail (Fehler werden geloggt, nie an Stripe zurückgemeldet)
          6. 200
```

Behandelte Events: `checkout.session.completed` (+ `async_payment_succeeded`/`_failed`),
`checkout.session.expired`, `charge.refunded`, `payment_intent.payment_failed`.

**Garantien**

* Der Browser kann den Zahlungsstatus nicht beeinflussen – `success_url` ist reine Anzeige.
* Ein ohne gültige Signatur gesendeter Webhook wird mit 400 abgewiesen, bevor irgendetwas passiert.
* Ein doppelt zugestellter Webhook läuft in den Unique-Constraint und tut nichts.
* Ein verspätet zugestellter Webhook kann eine bereits `PAID`-Bestellung nicht erneut verarbeiten,
  weil die Statusänderung als `updateMany({ where: { id, paymentStatus: 'PENDING' } })` formuliert ist
  und dann 0 Zeilen trifft (optimistische Nebenläufigkeitsprüfung, kein Read-Modify-Write).
* Es werden keinerlei Kartendaten, PayPal-Konten oder Tokens gespeichert – nur Stripe-IDs.

---

## 7. Bestellnummern und Zugriffsschutz

Zwei getrennte Bezeichner, weil sie zwei verschiedene Aufgaben haben:

| Feld | Beispiel | Zweck | Entropie |
|---|---|---|---|
| `orderNumber` | `ABI-7F4K92` | Kommunikation, Ausgabeliste, Support | ~30 Bit – **kein Zugriffsschutz** |
| `publicToken` | 43 Zeichen base64url | URL `/bestellung/<token>` | 256 Bit |

Die URL enthält **nur** den Token. Fortlaufende IDs tauchen öffentlich nirgends auf; die interne
`id` ist eine CUID und verlässt den Adminbereich nicht. Ein Durchprobieren von Tokens ist
rechnerisch ausgeschlossen und wird zusätzlich durch Rate Limiting gebremst. Beide Felder werden
aus `crypto.randomBytes` erzeugt, `orderNumber` über ein Crockford-Base32-Alphabet ohne
verwechselbare Zeichen (kein I, L, O, U).

---

## 8. Sicherheitskonzept

| Risiko | Maßnahme |
|---|---|
| Broken Access Control | Jede Admin-Seite und jede Action ruft serverseitig `requireUser(role)`. Der Proxy ist nur eine zusätzliche Hürde, nie der einzige Schutz. Ausgeblendete Buttons gelten nicht als Schutz. |
| IDOR | Bestellungen ausschließlich über 256-Bit-Token; Admin-Zugriff nur mit Rolle; keine numerischen IDs nach außen. |
| SQL Injection | Ausschließlich Prisma-Query-Builder, kein `$queryRawUnsafe`, keine String-Konkatenation in SQL. |
| XSS | React escaped standardmäßig; kein `dangerouslySetInnerHTML`; Rechtstexte werden als Klartext gerendert; strikte CSP mit Nonce. |
| CSRF | Server Actions mit Next-eigener Origin-Prüfung, `SameSite=Lax`-Cookies, zusätzlich expliziter Origin-Check für sensible Route Handler. |
| Session Security | Opake 256-Bit-Tokens, nur Hash in der DB, `httpOnly`+`secure`+`SameSite=Lax`, Rotation bei Login, absolute Ablaufzeit, serverseitiges Logout (Session-Zeile wird gelöscht). |
| Authentication | Argon2id, TOTP-2FA, Account-Lockout nach Fehlversuchen, generische Fehlermeldung („E-Mail oder Passwort falsch“), keine User-Enumeration. |
| Authorization | Zwei Rollen. `DISTRIBUTION` erreicht ausschließlich Suche und Ausgabe – geprüft in jeder einzelnen Action, nicht nur im Layout. |
| Rate Limiting | Login, Checkout, Bestellabfrage, Suche, Mailversand. Fixed-Window-Zähler im Prozess (ein Container) + persistenter Lockout am User-Datensatz. |
| Preismanipulation | Preise kommen nie vom Client. Server lädt Variante → Preis → rechnet → speichert Snapshot. |
| Mengenmanipulation | `z.number().int().min(1).max(N)` pro Position, Obergrenze für Positionen und Gesamtmenge je Bestellung. |
| Zahlungsmanipulation | Status nur über signierten Webhook, nie über Redirect; Stripe-Session aus DB-Preisen; Abgleich des Betrags. |
| Webhook-Manipulation | `constructEvent` mit Signatur und Zeitfenster-Toleranz; ohne `STRIPE_WEBHOOK_SECRET` startet die Route nicht. |
| Replay | `StripeWebhookEvent`-Tabelle (Unique-PK) + bedingte Statusübergänge. |
| Race Conditions | `updateMany` mit Statusbedingung statt Lesen-Prüfen-Schreiben; Transaktionen für Order+Items und für Ausgabe+Statusneuberechnung. |
| Secret-Leaks | Zentrale, mit Zod validierte `env`-Datei; `server-only` verhindert Import in Client-Bundles; nur `NEXT_PUBLIC_*` erreicht den Browser; `.env*` ist gitignored. |
| Unsichere Uploads | Nur ADMIN; max. 2 MB; erlaubt sind PNG/JPEG/WebP, geprüft an den **Magic Bytes**, nicht am Dateinamen; Speicherung unter zufälligem Namen außerhalb des Webroots; Auslieferung über Route Handler mit festem Content-Type, `nosniff` und `Content-Disposition: inline`. |
| Security Misconfiguration | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`; `x-powered-by` aus; Container läuft als Nicht-Root. |
| Fehlerbehandlung | Nach außen nur generische Meldungen mit Fehler-ID, Details ausschließlich im Serverlog. |

---

## 9. Ausgabe (iPad)

`/admin/distribution` bekommt ein **eigenes Layout** ohne Admin-Navigation: großes Suchfeld,
Trefferliste mit Namen, Klasse und Bestellnummer, danach die Positionsliste mit großen
Schaltflächen (mind. 64 px Höhe), hoher Kontrast, keine Scrollfallen.

* Autocomplete ab 2 Zeichen, Suche in Vor- und Nachname, mit Debounce, `AbortController`
  und serverseitigem Limit.
* Es werden nur **bezahlte** Bestellungen angezeigt – ausgegeben wird nur, was bezahlt ist.
* Jede Position hat einen eigenen Status; „Alles ausgeben“ zeigt vorher eine Bestätigung.
* Bereits ausgegebene Positionen sind gesperrt; ein erneuter Klick ist wirkungslos und wird
  als Hinweis zurückgemeldet, nicht als Fehler.
* Nach vollständiger Ausgabe springt die Ansicht automatisch zur Suche zurück.
* Nebenläufigkeit (zwei iPads gleichzeitig): `updateMany` mit `distributionStatus: NOT_DISTRIBUTED`
  in der Bedingung. Wer als Zweiter klickt, trifft 0 Zeilen und bekommt „war bereits ausgegeben“.

---

## 10. Datenschutz und Recht

Erhoben werden **nur** Vorname, Nachname, E-Mail und Klasse – nichts darüber hinaus,
insbesondere keine Adresse, kein Geburtsdatum, keine Telefonnummer.

Weitergabe: Name, E-Mail und Betrag an Stripe (Zahlungsabwicklung), Name, E-Mail und
Bestellinhalt an den Mailversender. Beides muss vor dem Livegang in der Datenschutzerklärung
stehen und über Auftragsverarbeitungsverträge abgedeckt sein.

Alle offenen rechtlichen Punkte – Betreiber, Zahlungsempfänger, Stripe-Konto, Rückerstattungen,
Löschfristen, Impressum, Widerrufsrecht (insbesondere die Frage, ob personalisierte Abi-Pullis
überhaupt vom Widerruf ausgenommen sind) – stehen in `LEGAL_CHECKLIST.md`.
**Nichts davon ist Rechtsberatung; alle Punkte müssen vor dem Livegang geprüft werden.**

---

## 11. Deployment

Ein Multi-Stage-Dockerfile mit `output: "standalone"`, Non-Root-User und Healthcheck;
`docker compose up` startet MySQL 8 + App. Der Entrypoint führt `prisma migrate deploy` aus,
bevor der Server startet. HTTPS terminiert ein vorgelagerter Reverse Proxy (Caddy/Traefik/nginx),
die App setzt HSTS und vertraut `X-Forwarded-Proto`. Backups: `mysqldump` per Cron auf ein
externes Ziel, Rücksicherung muss **vor** dem Livegang einmal getestet werden.

---

## 12. Vor dem Livegang zu klären

1. Wer ist Betreiber und Verkäufer? Schule, Förderverein, Abi-Komitee oder eine Privatperson?
2. Auf welches Stripe-Konto laufen die Zahlungen, und wer haftet für Rückerstattungen?
3. Ist PayPal für dieses Stripe-Konto und Land freigeschaltet?
4. Impressumspflicht und Inhalte – abhängig von Antwort 1.
5. Widerrufsrecht: Bei personalisierten Artikeln **nicht pauschal** ausgeschlossen. Prüfen lassen.
6. Speicherdauer der Bestelldaten und Löschkonzept nach der Ausgabe.
7. AV-Verträge mit Stripe und dem Mailversender.
8. Minderjährige Besteller: Zustimmung der Erziehungsberechtigten nötig?
9. Domain, TLS-Zertifikat, Hosting-Standort (EU).
10. Wer bekommt Admin-Zugänge, wer nur den Ausgabe-Zugang?
