'use client';

import { useSyncExternalStore } from 'react';

/**
 * Countdown bis zum Bestellschluss.
 *
 * Die Uhr läuft ausschließlich im Browser. Serverseitig und während der Hydration gibt
 * es bewusst keinen Wert – sonst würde der Server eine Sekunde rendern, die im Browser
 * schon vorbei ist, und React würde die Seite wegen des Unterschieds neu aufbauen.
 * Bis der Browser übernimmt, steht an der Stelle schlicht das Datum.
 *
 * Verbindlich ist der Countdown ohnehin nicht: Ob noch bestellt werden darf, entscheidet
 * der Server beim Anlegen der Bestellung.
 */

function subscribe(onStoreChange: () => void): () => void {
  const timer = setInterval(onStoreChange, 1000);
  return () => clearInterval(timer);
}

/** Auf volle Sekunden gerundet – sonst liefert jeder Aufruf einen neuen Wert. */
function getSnapshot(): number {
  return Math.floor(Date.now() / 1000);
}

function getServerSnapshot(): number {
  return 0;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function OrderCountdown({
  endAtIso,
  deadlineLabel,
}: {
  endAtIso: string;
  deadlineLabel: string;
}) {
  const nowSeconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const endSeconds = Math.floor(Date.parse(endAtIso) / 1000);

  if (nowSeconds === 0 || !Number.isFinite(endSeconds)) {
    return (
      <p className="text-sm text-white/70">
        Bestellschluss: <span className="font-semibold text-white">{deadlineLabel}</span>
      </p>
    );
  }

  const remaining = Math.max(0, endSeconds - nowSeconds);

  if (remaining === 0) {
    return <p className="text-sm font-semibold text-white">Der Bestellzeitraum ist beendet.</p>;
  }

  const parts = [
    { value: Math.floor(remaining / 86400), label: 'Tage' },
    { value: Math.floor(remaining / 3600) % 24, label: 'Std' },
    { value: Math.floor(remaining / 60) % 60, label: 'Min' },
    { value: remaining % 60, label: 'Sek' },
  ];

  return (
    <div>
      <p className="eyebrow text-gold-400">Noch bestellbar bis {deadlineLabel}</p>
      {/*
        Der Gesamtwert steht als Text für Screenreader daneben; die einzelnen Kacheln
        würden sonst als sinnlose Zahlenkolonne vorgelesen. aria-live bleibt aus – eine
        jede Sekunde vorgelesene Uhr ist eine Zumutung.
      */}
      <p className="sr-only">
        Noch {parts[0]?.value} Tage, {parts[1]?.value} Stunden und {parts[2]?.value} Minuten bis zum
        Bestellschluss.
      </p>
      <div aria-hidden="true" className="mt-3 flex gap-2 sm:gap-3">
        {parts.map((part) => (
          <div
            key={part.label}
            className="min-w-16 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center backdrop-blur-sm sm:min-w-20"
          >
            <span className="font-display block text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
              {pad(part.value)}
            </span>
            <span className="text-[0.65rem] font-semibold tracking-[0.18em] text-white/50 uppercase">
              {part.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
