import { describe, expect, it } from 'vitest';
import { safeHref, stripLeadingHeading } from '@/lib/markdown';

/**
 * Die Rechtstexte kommen aus dem Adminbereich und werden als Markdown ausgegeben.
 * Geprueft wird hier genau das, was daran sicherheitsrelevant ist: welche Linkziele
 * ueberhaupt durchgelassen werden.
 */

describe('safeHref', () => {
  it('laesst uebliche Protokolle durch', () => {
    expect(safeHref('https://example.de/impressum')).toBe('https://example.de/impressum');
    expect(safeHref('http://example.de')).toBe('http://example.de');
    expect(safeHref('mailto:info@example.de')).toBe('mailto:info@example.de');
    expect(safeHref('tel:+4912345')).toBe('tel:+4912345');
  });

  it('laesst relative Ziele innerhalb des Shops durch', () => {
    expect(safeHref('/rechtliches/agb')).toBe('/rechtliches/agb');
    expect(safeHref('#kontakt')).toBe('#kontakt');
  });

  it('verwirft javascript:-URLs', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    // Gross-/Kleinschreibung und fuehrende Leerzeichen duerfen nichts daran aendern.
    expect(safeHref('JavaScript:alert(1)')).toBeNull();
    expect(safeHref('  javascript:alert(1)')).toBeNull();
  });

  it('verwirft data:-URLs', () => {
    expect(safeHref('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
  });

  it('verwirft leere und unlesbare Angaben', () => {
    expect(safeHref(undefined)).toBeNull();
    expect(safeHref('')).toBeNull();
    expect(safeHref('nicht mal eine url')).toBeNull();
  });
});

describe('stripLeadingHeading', () => {
  it('entfernt eine fuehrende Ueberschrift der Ebene 1', () => {
    expect(stripLeadingHeading('# Impressum\n\nInhalt')).toBe('Inhalt');
  });

  it('entfernt fuehrende Leerzeilen vor der Ueberschrift mit', () => {
    expect(stripLeadingHeading('\n\n# Impressum\n\nInhalt')).toBe('Inhalt');
  });

  it('laesst Ueberschriften weiter unten im Text stehen', () => {
    const input = 'Einleitung\n\n# Kontakt\n\nMail';
    expect(stripLeadingHeading(input)).toBe(input);
  });

  it('laesst Ueberschriften tieferer Ebenen unangetastet', () => {
    const input = '## Angaben gemaess Paragraf 5 DDG\n\nInhalt';
    expect(stripLeadingHeading(input)).toBe(input);
  });

  it('kommt mit einem Text klar, der nur aus der Ueberschrift besteht', () => {
    expect(stripLeadingHeading('# Impressum')).toBe('');
  });
});
