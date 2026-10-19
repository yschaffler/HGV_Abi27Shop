# Bilder unter public/img

**Die Produktfotos werden nicht hier gepflegt, sondern im Adminbereich** unter
*Produkte › Bilder* – je Artikel bis zu acht Bilder mit Beschriftung und Reihenfolge. Das
erste Bild ist das Titelbild und erscheint auch im Hero der Startseite.

Hier liegen nur noch:

| Datei | Wozu |
|---|---|
| `hoodie-back.webp` | Rückfall für den Hero, solange noch kein Artikel ein Bild hat |
| `hoodie-front.webp`, `hoodie-detail.webp` | Mockups, die der Entwicklungs-Seed (`npm run db:seed`) als Galerie an den Hoodie hängt |
| `logo-dark.png` | Jahrgangslogo in Kopfzeile, Fußzeile und auf der Zugangsseite – wird erzeugt, nicht von Hand ersetzen |
| `logo.png` | Vorlage des Jahrgangslogos; nach dem Austausch `npm run logo:brand` ausführen |

Tipps für die Fotos im Adminbereich:

* **Hochformat 4:5**, PNG, JPEG oder WebP, höchstens 2 MB.
* Die Galerie steht auf hellem Grund und passt das Bild ein, statt es zu beschneiden. Ein
  ruhiger, heller Hintergrund oder ein freigestelltes Bild wirkt am besten.
* Die Beschriftung ("Vorne", "Hinten") wird zusammen mit dem Artikelnamen auch als
  Bildbeschreibung vorgelesen – kurz und treffend halten.

## Die zwei Marken

Im Shop stehen zwei Zeichen, mit getrennten Aufgaben:

* **Jahrgangslogo "HGV ABI 2027"** (`logo-dark.png`) – sagt, *wer* hier bestellt. Es steht in
  Kopfzeile, Fußzeile und auf der Zugangsseite. Kopfzeile und Fußzeile sind immer dunkel,
  deshalb wird dort nur die helle Fassung gebraucht. Sie ist aus `logo.png` einfarbig in
  Creme gerechnet (`npm run logo:brand`), passend zum zweifarbigen Druck.
* **Lorbeer-Emblem** – der Brustdruck von Hoodie und Shirt, also das *Was*. Es steht über
  der Kollektion. Es ist **kein Bild**, sondern gezeichnet:
  `src/components/shop/abi-emblem.tsx`. Dadurch ist es bei jeder Größe scharf.

Das Favicon (`src/app/icon.svg`) zeigt Säule und Lorbeer, weil der Pinguin bei 16 Pixeln
nicht mehr zu erkennen wäre.
