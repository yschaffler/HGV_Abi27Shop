# Produktbilder

Der Shop lädt die Bilder über feste Pfade. Sobald es echte Produktfotos gibt, werden einfach
**diese Dateien ersetzt** – es muss keine Zeile Code geändert werden.

| Datei | Wo es erscheint | Empfohlen |
|---|---|---|
| `hoodie-front.webp` | Galerie "Vorne" | hochkant, ca. 1000 × 1500 px |
| `hoodie-back.webp` | Hero auf der Startseite **und** Galerie "Hinten" | hochkant, ca. 1000 × 1500 px |
| `hoodie-detail.webp` | Galerie "Detail" | quer, ca. 1200 × 800 px |
| `logo-dark.png` | Jahrgangslogo in Kopfzeile, Fußzeile und auf der Zugangsseite | quer, transparent, helle Fassung |
| `logo.png` | dieselbe Marke in der dunklen Fassung, derzeit nicht eingebunden | quer, transparent |

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

## Die zwei Marken

Im Shop stehen zwei Zeichen, mit getrennten Aufgaben:

* **Jahrgangslogo "HGV ABI 2027"** (`logo-dark.png`) – sagt, *wer* hier bestellt. Es steht in
  Kopfzeile, Fußzeile und auf der Zugangsseite. Kopfzeile und Fußzeile sind immer dunkel,
  deshalb wird dort nur die helle Fassung gebraucht; `logo.png` liegt als dunkle Fassung
  bereit, falls das Logo einmal auf hellem Grund stehen soll.
* **Lorbeer-Emblem** – der Brustdruck des Hoodies, also das *Was*. Es steht beim Artikel.
  Es ist **kein Bild**, sondern gezeichnet: `src/components/shop/abi-emblem.tsx`. Dadurch ist
  es bei jeder Größe scharf und färbt sich mit dem Farbschema mit.

Das Favicon (`src/app/icon.svg`) zeigt Säule und Lorbeer, weil der Pinguin bei 16 Pixeln
nicht mehr zu erkennen wäre.
