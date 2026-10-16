/**
 * Rechnet das Jahrgangslogo für dunkle Flächen auf die Shop-Palette um.
 *
 * Der Shop kennt nur zwei Farben – Navy als Stoff, Creme als Druckfarbe, wie der Hoodie.
 * Auf Navy steht das Logo deshalb einfarbig in Creme, als wäre es mit aufgedruckt. Die
 * Helligkeitsstufen der Vorlage bleiben als Deckkraft erhalten, damit der Pinguin seine
 * Zeichnung (Bauch, Flügel, Schnabel) nicht verliert.
 *
 *   Vorlage:  public/img/logo.png       (bleibt unangetastet)
 *   Ergebnis: public/img/logo-dark.png  (Kopfzeile, Fußzeile, Zugangsseite)
 *
 * Aufruf: npm run logo:brand
 * Nötig nur, wenn logo.png ausgetauscht wird oder sich die Druckfarbe ändert.
 */
import sharp from 'sharp';

const CREME = [243, 234, 216] as const;

async function main(): Promise<void> {
  const { data, info } = await sharp('public/img/logo.png')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha === 0) continue;

    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const bunt = Math.max(r, g, b) - Math.min(r, g, b) > 45;

    // Dunkles und Farbiges wird voll gedruckt, Helles (Pinguinbauch) nur angedeutet –
    // so bleibt die Zeichnung lesbar, obwohl nur noch eine Farbe übrig ist.
    const deckkraft = bunt ? 1 : Math.max(0.35, 1 - lum * 0.75);

    data[i] = CREME[0];
    data[i + 1] = CREME[1];
    data[i + 2] = CREME[2];
    data[i + 3] = Math.round(alpha * deckkraft);
  }

  const result = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile('public/img/logo-dark.png');

  process.stdout.write(`logo-dark.png geschrieben (${result.width}×${result.height})\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
