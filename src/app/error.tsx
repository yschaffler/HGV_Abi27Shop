'use client';

import Link from 'next/link';

/**
 * Sichtbare Fehlerseite.
 *
 * Hier steht bewusst keine technische Information. Next liefert im Produktionsbetrieb
 * ohnehin nur eine anonymisierte `digest`-Kennung an den Client; genau die zeigen wir an,
 * damit man den passenden Eintrag im Serverlog wiederfindet. Stacktraces, Query-Fehler
 * oder Konfigurationswerte erreichen den Browser nie.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl">Da ist etwas schiefgelaufen</h1>
      <p className="text-muted">
        Der Vorgang konnte nicht abgeschlossen werden. Bitte versuche es noch einmal.
      </p>
      {error.digest ? (
        <p className="text-muted text-sm">
          Fehlerkennung: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Erneut versuchen
        </button>
        <Link href="/" className="btn-secondary">
          Zur Startseite
        </Link>
      </div>
    </main>
  );
}
