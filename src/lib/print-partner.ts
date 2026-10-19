/**
 * Der Textildrucker, bei dem die Sammelbestellung aufgegeben wird.
 *
 * Steht hier zentral statt in den Einstellungen: Es gibt genau einen Drucker pro Jahrgang,
 * und der Link ist ein fest geprüftes https-Ziel – kein Freitext, der irgendwohin zeigen
 * könnte. Welches Modell je Produkt bestellt wird, pflegt der Adminbereich am Produkt.
 */
export const PRINT_PARTNER = {
  name: 'Shirtival',
  url: 'https://shirtival.de/abihoodies/produktauswahl',
} as const;
