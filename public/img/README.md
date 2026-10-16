# Produktbilder

Der Shop lädt die Bilder über feste Pfade. Sobald es echte Produktfotos gibt, werden einfach
**diese Dateien ersetzt** – es muss keine Zeile Code geändert werden.

| Datei | Wo es erscheint | Empfohlen |
|---|---|---|
| `hoodie-front.webp` | Galerie "Vorne" | hochkant, ca. 1000 × 1500 px |
| `hoodie-back.webp` | Hero auf der Startseite **und** Galerie "Hinten" | hochkant, ca. 1000 × 1500 px |
| `hoodie-detail.webp` | Galerie "Detail" | quer, ca. 1200 × 800 px |

Hinweise:

* **Format WebP**, Qualität um 90. Ein JPEG tut es auch – dann die Dateiendung im Code
  mitziehen (`src/app/(shop)/(gated)/page.tsx`, Konstante `GALLERY`).
* **Hintergrund dunkel lassen.** Galerie und Hero stehen auf Navy; ein Foto auf weißem
  Grund bekäme dort einen harten Rand. Am besten vor dunklem Hintergrund fotografieren
  oder freistellen.
* Die Bildbeschreibungen (`alt`) stehen in `GALLERY` und sollten zum neuen Foto passen –
  sie werden vorgelesen, wenn das Bild nicht lädt.

Die aktuellen Dateien sind Ausschnitte aus dem Designblatt "Design 3" und entsprechend
niedrig aufgelöst. Sie sind Platzhalter, bis echte Fotos vorliegen.

Das Lorbeer-Emblem (Kopfzeile, Fußzeile, Zugangsseite) ist **kein Bild**, sondern gezeichnet:
`src/components/shop/abi-emblem.tsx`. Dadurch ist es bei jeder Größe scharf und färbt sich
mit dem Farbschema mit.
