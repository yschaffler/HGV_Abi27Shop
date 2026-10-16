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
      <p className="text-creme-300/70 text-sm">
        Bestellschluss: <span className="text-creme-200 font-semibold">{deadlineLabel}</span>
      </p>
    );
  }

  const remaining = Math.max(0, endSeconds - nowSeconds);

  if (remaining === 0) {
    return <p className="text-creme-200 text-sm font-semibold">Der Bestellzeitraum ist beendet.</p>;
  }

  const parts = [
    { value: Math.floor(remaining / 86400), label: 'Tage' },
    { value: Math.floor(remaining / 3600) % 24, label: 'Std' },
    { value: Math.floor(remaining / 60) % 60, label: 'Min' },
    { value: remaining % 60, label: 'Sek' },
  ];

  return (
    <div>
      <p className="eyebrow text-creme-300/60">Noch bestellbar bis {deadlineLabel}</p>
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
            className="border-creme-300/20 min-w-16 rounded-xl border bg-white/5 px-3 py-2 text-center backdrop-blur-sm sm:min-w-20"
          >
            <span className="font-display text-creme-200 block text-3xl leading-none sm:text-4xl">
              {pad(part.value)}
            </span>
            <span className="text-creme-300/50 text-[0.65rem] font-semibold tracking-[0.18em] uppercase">
              {part.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
