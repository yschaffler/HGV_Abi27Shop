const sharp = require('sharp');

/*
 * Das Jahrgangslogo fuer dunkle Flaechen auf die Shop-Palette bringen.
 *
 * Die Vorlage hat einen hellen, leuchtenden Goldton. Neben dem gedeckten Oliv-Gold der
 * Marke (#A3A05A) wirken zwei Goldtoene nebeneinander wie ein Versehen. Deshalb:
 *
 *   unbunte Pixel (Schriftzug, Pinguin)  ->  Creme #F3EAD8, Helligkeit umgekehrt
 *   bunte Pixel  (ABI 2027, Schnabel)    ->  Oliv-Gold der Marke, Helligkeit erhalten
 *
 * Die Vorlage logo.png bleibt unangetastet – wer das Original zurueckwill, aendert eine
 * Zeile in der Kopfzeile.
 *
 * Aufruf aus dem Projektverzeichnis:  node scripts/logo-brand.cjs
 * Noetig nur, wenn logo.png ausgetauscht wird oder sich die Markenfarben aendern.
 */
const CREME = [243, 234, 216];
const GOLD = [163, 160, 90];

function mischen(ziel, faktor) {
  return ziel.map((c) => Math.max(0, Math.min(255, Math.round(c * faktor))));
}

sharp('public/img/logo.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;

      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

      if (max - min > 45) {
        // Bunt: Oliv-Gold, Helligkeitsverlauf der Vorlage beibehalten.
        const [nr, ng, nb] = mischen(GOLD, 0.75 + lum * 0.5);
        data[i] = nr; data[i + 1] = ng; data[i + 2] = nb;
      } else {
        // Unbunt: Helligkeit umkehren, damit Schwarz auf Navy zu Creme wird.
        const [nr, ng, nb] = mischen(CREME, 1 - lum * 0.42);
        data[i] = nr; data[i + 1] = ng; data[i + 2] = nb;
      }
    }

    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile('public/img/logo-dark.png');
  })
  .then((r) => console.log('logo-dark.png', r.width + 'x' + r.height, r.size + ' bytes'));
