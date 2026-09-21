# Sicherheit

Dieses Dokument beschreibt, **wie** der Abi-Shop abgesichert ist, **was vor dem Livegang
geprüft wurde** und **wo bewusst Grenzen gezogen wurden**.

Grundhaltung: Der Client ist niemals vertrauenswürdig. Weder der Browser eines Schülers noch
der eines Admins. Jede Entscheidung, an der Geld, Berechtigungen oder Warenausgabe hängen,
fällt auf dem Server.

---

## 1. Preis-, Mengen- und Zahlungsmanipulation

**Preise kommen nie vom Client.** Der Warenkorb im Browser speichert ausschließlich
Varianten-IDs und Mengen. Der Eingabetyp der Preisberechnung
(`src/server/shop/pricing.ts`) enthält gar kein Preisfeld – Preismanipulation ist dadurch
nicht „verhindert“, sondern strukturell unmöglich. Zusätzlich entfernt Zod fremde Felder
bereits bei der Validierung.

Der Server lädt die Variante aus der Datenbank, prüft ob Variante und Produkt aktiv sind,
nimmt den Preis von dort, rechnet die Summe selbst und speichert sie als Snapshot in der
Bestellposition. Eine spätere Preisänderung am Katalog verändert bezahlte Bestellungen nicht.

**Mengen** sind doppelt begrenzt: pro Position und pro Bestellung. Mehrfach genannte
Varianten werden zusammengefasst, **bevor** die Grenzen geprüft werden – sonst ließe sich die
Obergrenze durch zehn Einzelzeilen derselben Variante umgehen.

**Bezahlt** wird eine Bestellung ausschließlich über den signaturgeprüften Stripe-Webhook.
Die Rückleitung in den Browser zeigt nur an. Zusätzlich müssen Betrag und Währung des Events
zur gespeicherten Bestellung passen; sonst wird nichts gebucht und der Vorgang laut geloggt.

## 2. Stripe-Webhook: Signatur, Replay, Nebenläufigkeit

* Der rohe Request-Body wird gelesen und unverändert an `constructEventAsync` gegeben. Kein
  JSON-Parsing davor – die Signatur gilt für genau diese Bytes.
* Stripe prüft dabei auch den Zeitstempel (Standardtoleranz fünf Minuten). Ein
  aufgezeichneter alter Request ist damit wertlos.
* Jede Event-ID wird als Primärschlüssel in `stripe_webhook_events` eingefügt, **bevor**
  irgendetwas passiert. Ein zweiter Zustellversuch läuft in den Unique-Constraint und bleibt
  wirkungslos. Stripe stellt Events garantiert mindestens einmal zu, also durchaus mehrfach.
* Statusübergänge sind bedingte Updates (`WHERE paymentStatus = 'PENDING'`), kein
  Lesen-Prüfen-Schreiben. Zwei gleichzeitig eintreffende Events können sich nicht überholen.
* Bei einem unerwarteten Fehler antwortet der Endpunkt mit 500, damit Stripe erneut zustellt.
  Die Idempotenz sorgt dafür, dass ein erfolgreicher zweiter Versuch nichts doppelt macht.

## 3. Zugriff auf Bestellungen (IDOR)

Zwei getrennte Bezeichner mit zwei verschiedenen Aufgaben:

| Feld | Beispiel | Zweck | Entropie |
|---|---|---|---|
| `orderNumber` | `ABI-7F4K92` | Kommunikation, Ausgabeliste | ~30 Bit – **kein** Zugriffsschutz |
| `publicToken` | 43 Zeichen base64url | URL `/bestellung/<token>` | 256 Bit |

Die URL enthält ausschließlich den Token. Ein Zugriff über Bestellnummer oder interne ID
existiert nicht und ist getestet. Fortlaufende IDs tauchen nach außen nirgends auf. Beide
Werte stammen aus `crypto.randomBytes`, nie aus `Math.random()`.

## 4. Authentifizierung

* **Argon2id** mit den OWASP-Referenzparametern (19 MiB, 2 Iterationen, Parallelität 1).
* **TOTP nach RFC 6238** als zweiter Faktor, Pflicht für die Rolle `ADMIN`.
* Das TOTP-Secret liegt **AES-256-GCM-verschlüsselt** in der Datenbank; der Schlüssel wird
  per HKDF aus `AUTH_SECRET` abgeleitet. Ein Datenbank-Dump allein erlaubt keine gültigen Codes.
* Acht **Notfallcodes**, einmalig nutzbar, Argon2-gehasht. Ihr Einlösen ist ein bedingtes
  Update – zwei gleichzeitige Versuche können denselben Code nicht zweimal verbrauchen.
* **Account-Lockout** nach acht Fehlversuchen für 15 Minuten, gespeichert in der Datenbank
  und damit über einen Neustart hinweg wirksam.
* **Keine User-Enumeration:** Ob eine E-Mail existiert, das Passwort falsch ist oder das
  Konto gesperrt ist, führt zur identischen Meldung. Für unbekannte Adressen wird trotzdem
  eine echte Argon2-Verifikation gerechnet, damit auch die Antwortzeit nichts verrät.

## 5. Sessions

* Cookie-Token: 256 Bit aus dem CSPRNG. In der Datenbank steht nur dessen **SHA-256-Hash**.
* Cookie-Attribute: `httpOnly`, `secure` (in Produktion), `sameSite=lax`, `path=/`,
  feste Ablaufzeit.
* Bei jedem Login wird ein frisches Token ausgestellt (Session Fixation).
* Abmelden **löscht die Session-Zeile**. Anders als bei einem JWT ist ein abgemeldetes Token
  sofort und serverseitig wertlos.
* Eine Session gilt erst nach dem zweiten Faktor als vollwertig; vorher erreicht sie
  ausschließlich den 2FA-Schritt.
* Wird ein Konto deaktiviert oder das Passwort geändert, werden alle Sessions dieses Kontos
  gelöscht.

## 6. Autorisierung

Zwei Rollen: `ADMIN` und `DISTRIBUTION`. Letztere erreicht ausschließlich Namenssuche und
Warenausgabe.

**Jede** geschützte Seite und **jede** zustandsändernde Action ruft serverseitig
`requireUser` beziehungsweise `authorize`. Der Proxy (`src/proxy.ts`) leitet nicht
angemeldete Besucher früh um, ist aber ausdrücklich nur Komfort – wer ihn löscht, verliert
Komfort, aber keinen Schutz. Ein ausgeblendeter Button gilt nicht als Schutz: Server Actions
sind aufrufbare Endpunkte.

Admin-Routen, die eine fehlende Berechtigung feststellen, antworten mit `404` statt `403`.
Wer die Rolle nicht hat, erfährt nicht einmal, dass es die Route gibt.

## 7. CSRF

Drei Ebenen, die unabhängig voneinander greifen:

1. Server Actions laufen ausschließlich über POST und vergleichen `Origin` gegen `Host`.
2. Das Session-Cookie ist `SameSite=Lax`. Eine fremde Seite bekommt bei einem
   seitenübergreifenden POST gar keine Session mitgeschickt.
3. Ein **eigener Origin-Check** in jeder zustandsändernden Action. Grund: Die Next-Doku hält
   fest, dass ein Request ganz ohne `Origin`-Header nur mit einer Warnung durchgelassen wird.
   Browser senden bei POST immer einen Origin, das Bestehen darauf kostet also nichts und
   schließt die Lücke für alles, was kein Browser ist.

## 8. Injection und XSS

* **SQL:** ausschließlich der Prisma-Query-Builder. Kein `$queryRawUnsafe` mit
  Benutzereingaben, keine String-Konkatenation in SQL. In Suchfeldern werden zusätzlich
  `%`, `_` und `\` entfernt, damit niemand über LIKE-Platzhalter die ganze Liste zieht.
* **XSS:** React escaped standardmäßig. `dangerouslySetInnerHTML` kommt im gesamten Projekt
  nicht vor. Rechtstexte aus den Einstellungen werden als Klartext gerendert. In E-Mails,
  die als String gebaut werden, geht jeder eingesetzte Wert durch `escapeHtml`.
* **CSP** mit Nonce und `strict-dynamic`, dazu `frame-ancestors 'none'`, `base-uri 'none'`,
  `object-src 'none'`. `style-src` erlaubt `'unsafe-inline'`, weil an einzelnen Stellen
  berechnete Inline-Styles verwendet werden (z. B. Balkenbreiten in der Statistik) –
  Inline-Styles sind kein Skriptausführungsvektor.
* **CSV-Injection:** Werte, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnen, bekommen beim
  Export einen Apostroph vorangestellt. Ohne das könnte sich jemand `=HYPERLINK(...)` als
  Nachnamen eintragen und im Export des Admins Code zur Ausführung bringen. Keine der
  üblichen CSV-Bibliotheken macht das von sich aus – deshalb ist der Export selbst geschrieben.

## 9. Datei-Uploads

Nur Admins, maximal 2 MB, erlaubt sind PNG, JPEG und WebP.

Geprüft wird am **Dateiinhalt** (Magic Bytes), nicht am Dateinamen und nicht am
mitgeschickten Content-Type – beides kann gelogen sein. Der Name auf der Platte wird selbst
erzeugt (UUID plus fester Suffix); der Browser-Name wird nur als Anzeigetext gespeichert und
nie als Pfad verwendet. Damit ist Path Traversal ausgeschlossen.

Die Dateien liegen außerhalb von `public/` und werden über einen Route Handler mit festem
Content-Type, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` und einer
eigenen restriktiven CSP ausgeliefert. Selbst eine Datei mit eingebettetem Skriptcode könnte
so nie als HTML oder JavaScript interpretiert werden.

## 10. Rate Limiting

| Endpunkt | Grenze |
|---|---|
| Anmeldung je IP | 10 / 15 min |
| Anmeldung je Konto | 5 / 15 min |
| Checkout je IP | 8 / 10 min |
| Bestellabfrage je IP | 60 / 5 min |
| Suche an der Ausgabe | 120 / min |
| Ausgabe-Aktionen | 300 / min |
| Bestätigungsmails je Empfänger | 5 / h |
| Exporte je Admin | 30 / 10 min |

Die Zähler liegen im Prozessspeicher. Bei **einer** Container-Instanz und rund 300
Bestellungen ist das die passende Lösung; Redis wäre zusätzliche Infrastruktur ohne Nutzen.
Ergänzend gibt es den persistenten Login-Lockout am Benutzerdatensatz, der einen Neustart
überlebt. **Wenn der Shop jemals auf mehrere Instanzen skaliert**, muss
`src/lib/rate-limit.ts` durch einen gemeinsamen Speicher ersetzt werden – das ist die einzige
Stelle, die dafür anzufassen ist.

`X-Forwarded-For` wird nur ausgewertet, wenn `TRUST_PROXY_HEADERS=true` gesetzt ist. Ohne
vertrauenswürdigen Proxy fällt alles auf denselben Schlüssel zurück: strenger als nötig,
aber niemals unsicherer.

## 10a. Zugangscode fuer den Shop

Der Bestellbereich laesst sich hinter einen Zugangscode legen (Adminbereich →
Einstellungen, oder `npm run access:code -- ABI27`). Wichtig ist, ihn richtig einzuordnen:

**Was er leistet.** Er haelt Fremde aus dem Shop, die zufaellig auf der Domain landen –
Suchmaschinen, Eltern anderer Jahrgaenge, Langeweile. Fuer einen Shop, der sich an genau
einen Jahrgang richtet, ist das der passende Schutzgrad.

**Was er nicht leistet.** Er ist kein Zugriffsschutz fuer personenbezogene Daten. Ein Code,
den 160 Leute im Abichat haben, ist kein Geheimnis. Wer eine fremde Bestellung sehen will,
braucht weiterhin deren 256-Bit-Token (Abschnitt 3) – daran aendert der Code nichts, und
darauf darf sich auch niemand verlassen.

**Umsetzung.**

* Gespeichert wird ausschliesslich ein **Argon2id-Hash** (`settings.accessCodeHash`). Der
  Code steht nirgends im Klartext und laesst sich auch im Adminbereich nicht auslesen,
  sondern nur ersetzen. Ein Datenbankabzug gibt ihn nicht preis.
* Das Cookie ist **HMAC-SHA256-signiert** (Schluessel: `AUTH_SECRET`), `httpOnly`,
  `sameSite=lax`, in Produktion `secure`, und laeuft nach 30 Tagen ab. Die Signatur wird
  **vor** dem Inhalt geprueft; verglichen wird mit `timingSafeEqual`.
* Im Cookie steht eine kurze, nicht umkehrbare Ableitung des aktuellen Code-Hashes. Wird der
  Code gewechselt, sind damit **alle bestehenden Freischaltungen ungueltig** – genau das
  erwartet man, wenn ein Code verbrannt ist.
* **Rate Limit**: 10 Versuche je IP in 10 Minuten. Bei einem kurzen Code ist das der
  eigentliche Schutz, nicht die Entropie.
* Die Eingabe wird normalisiert (Leerzeichen raus, Grossbuchstaben) – an genau einer Stelle,
  die sowohl beim Setzen als auch beim Pruefen benutzt wird.
* Die Schranke sitzt im Layout der Routengruppe `app/(shop)/(gated)`. Wer dort eine Seite
  ergaenzt, bekommt sie automatisch mit und kann sie nicht vergessen.

**Bewusst ohne Schranke** bleiben: `/rechtliches/*` (Impressum und Datenschutzerklaerung
muessen ohne Huerde erreichbar sein), `/bestellung/<token>` (dort ist der Token das
Zugangsmerkmal), der Adminbereich mit eigener Anmeldung und der Stripe-Webhook.

## 11. Race Conditions

Nirgends Lesen-Prüfen-Schreiben, überall bedingte Updates:

* Zahlung: `updateMany({ where: { id, paymentStatus: 'PENDING' } })`
* Ausgabe: `updateMany({ where: { id, distributionStatus: 'NOT_DISTRIBUTED' } })`
* Notfallcode: `updateMany({ where: { id, usedAt: null } })`
* Webhook-Idempotenz: `create` gegen einen Unique-Primärschlüssel

Ausgabe und Neuberechnung des Bestellstatus laufen in derselben Transaktion. Der
denormalisierte `Order.distributionStatus` kann dadurch nicht von den Positionen abweichen.

Getestet: acht gleichzeitige Klicks auf denselben Artikel geben ihn genau einmal aus;
fünf gleichzeitige „Alles ausgeben“ zählen zusammen genau die vorhandenen Positionen.

## 12. Secrets und Fehlerbehandlung

* Zentrale, mit Zod validierte Konfiguration. Fehlermeldungen nennen den **Namen** der
  Variable, nie ihren Wert.
* `.env*` ist gitignored, `.dockerignore` schließt es zusätzlich aus.
* Module unter `src/server/` importieren `server-only` und können dadurch nicht versehentlich
  in einem Client-Bundle landen.
* Es gibt bewusst keine `NEXT_PUBLIC_*`-Variablen.
* Der Logger ersetzt Werte zu Feldern, die nach Geheimnis klingen (Passwort, Token, Secret,
  Signatur, Cookie, DATABASE_URL …), automatisch durch `[redacted]`.
* Nach außen gibt es nur verständliche Meldungen plus eine kurze Fehlerkennung; Stacktraces,
  Prisma-Fehler und Konfigurationswerte bleiben im Serverlog.

## 13. Datensparsamkeit

Erhoben werden ausschließlich Vorname, Nachname, E-Mail und Klasse. Keine Adresse, kein
Geburtsdatum, keine Telefonnummer. Das Audit-Log speichert Akteur, Aktion, Entität und eine
kurze Zusammenfassung – keine IP-Adressen, keine Request-Inhalte, keine Kontaktdaten von
Bestellern. Zahlungsdaten werden nirgends gespeichert, nur Stripe-Referenzen.

---

## Security Review vor dem Launch

Durchgeführt gegen die laufende Anwendung, ergänzt durch die automatisierte Testsuite
(160 Tests).

```
[x] Authentication          Argon2id, TOTP-Pflicht für Admins, Lockout, keine Enumeration
[x] Authorization           Rollenprüfung serverseitig in jeder Seite und jeder Action
[x] Admin-Schutz            /admin ohne Anmeldung -> Redirect; Admin-APIs -> 404
[x] IDOR                    /bestellung/1001 -> 404; Zugriff nur über 256-Bit-Token
[x] XSS                     Skript-Nutzlast als Produktname angelegt: als Text gerendert,
                            nicht ausgeführt, kein Dialog
[x] Injection               SQL-Nutzlasten in der Bestellsuche: wirkungslos, Tabellen intakt
[x] CSRF                    Server Action mit fremder Origin: von Next abgewiesen,
                            zusätzlich eigener Origin-Check
[x] Rate Limiting           greift nachweislich (Konto-Limit hat wiederholte Testläufe gebremst)
[x] Session Security        Hash statt Token in der DB, erfundenes Cookie -> Redirect,
                            abgelaufene und deaktivierte Sessions werden entfernt
[x] Preismanipulation       Client-Preis wirkungslos, durch Tests abgedeckt
[x] Mengenmanipulation      Grenzen je Position und je Bestellung, Umgehung getestet
[x] Zahlungsmanipulation    Status nur über Webhook, Betrags- und Währungsabgleich
[x] Webhook Verification    ohne Signatur -> 400, gefälschte Signatur -> 400,
                            nachträglich geänderter Betrag -> 400
[x] Replay Protection       Event-ID als Primärschlüssel, 10 gleichzeitige Zustellungen
                            desselben Events -> genau eine Verarbeitung
[x] Secrets                 keine im Code, keine im Client-Bundle, Logger maskiert
[x] Datenbank               Fremdschlüssel, Unique-Constraints, Indizes, Transaktionen
[x] Fehlerbehandlung        nur generische Meldungen mit Fehlerkennung nach außen
[x] HTTPS                   HSTS in Produktion, APP_URL muss https sein
[x] Backups                 Verfahren dokumentiert  -> Rücksicherung muss getestet werden
[x] Dependencies            npm audit vor jedem Release  -> siehe unten
[x] Datenschutz             Datensparsamkeit umgesetzt  -> LEGAL_CHECKLIST.md abarbeiten
```

Beim Review gefundene und behobene Fehler:

1. Notfallcodes konnten verloren gehen, wenn das Formular ohne JavaScript abgeschickt wurde.
2. Der Umschalter auf den Notfallcode und die Bestätigung der Codes funktionierten nur mit
   JavaScript – ausgerechnet bei der Rückfallebene der Anmeldung.
3. Server Actions ohne `Origin`-Header wurden nur von Next gewarnt, nicht abgewiesen.

---

## Bewusste Grenzen

Diese Punkte sind keine Versäumnisse, sondern Entscheidungen. Wer die Rahmenbedingungen
ändert, muss sie neu bewerten.

* **Rate Limiting im Prozessspeicher.** Nur bei einer Instanz wirksam. Siehe Abschnitt 10.
* **Kein 2FA-Zwang für `DISTRIBUTION`.** Diese Konten bedienen ein gemeinsam genutztes iPad
  am Ausgabetag und kommen ausschließlich an Namenssuche und Ausgabe. Ein erzwungener
  zweiter Faktor pro Helfer stünde in keinem Verhältnis. 2FA ist für diese Konten möglich.
* **Der Adminbereich setzt JavaScript voraus.** Er ist eine React-Oberfläche. Ausdrücklich
  ohne JavaScript funktionsfähig sind die sicherheitskritischen Teile der Anmeldung:
  Passwort, zweiter Faktor, Notfallcode und die Einrichtung.
* **Keine Zwei-Personen-Regel für Statusänderungen.** Ein Admin kann eine Bestellung manuell
  auf „bezahlt“ setzen. Bei einem Jahrgangs-Shop ist das nötig (Barzahlung, Sonderfälle) und
  über das Audit-Log nachvollziehbar.
* **Keine automatische Löschung alter Bestellungen.** Die Löschfrist ist eine rechtliche
  Entscheidung, keine technische – siehe `LEGAL_CHECKLIST.md`.

---

## Abhängigkeiten aktuell halten

```bash
npm audit
npm outdated
```

Vor jedem Release ausführen. Sicherheitsrelevante Updates von Next.js, Prisma und Stripe
zeitnah einspielen; nach dem Update `npm test`, `npm run typecheck` und `npm run lint`.

---

## Eine Schwachstelle melden

Wer ein Sicherheitsproblem findet: bitte **nicht** öffentlich posten, sondern direkt an die
in den Einstellungen hinterlegte Kontaktadresse des Shops melden. Da echte Bestell- und
Zahlungsvorgänge daran hängen, ist eine kurze Nachricht mehr wert als ein öffentlicher Hinweis.
