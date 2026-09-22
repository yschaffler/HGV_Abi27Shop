'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  distributeAllAction,
  distributeItemAction,
  loadOrderAction,
  type DistributionOrderView,
} from '@/app/admin/distribution/actions';

/**
 * Ausgabeschalter.
 *
 * Der ganze Ablauf ist auf eine einzige Bewegung ausgelegt:
 *   Name tippen → Person antippen → Artikel aushändigen → antippen → nächste Person.
 *
 * Deshalb: großes Suchfeld mit Autofokus, Treffer als große Kacheln, Positionen als
 * 72 Pixel hohe Schaltflächen, und nach vollständiger Ausgabe springt die Ansicht von
 * selbst zurück zur Suche. Kein Scrollen, keine kleinen Bedienelemente, kein ERP-Gefühl.
 */

type SearchHit = {
  id: string;
  orderNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  itemCount: number;
  distributedCount: number;
};

const SEARCH_DEBOUNCE_MS = 180;
const RETURN_TO_SEARCH_MS = 1600;

export function DistributionDesk() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState<DistributionOrderView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const searchRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const focusSearch = useCallback(() => {
    // Ohne kurzes Warten setzt Safari den Fokus beim Umbau der Ansicht wieder zurück.
    window.setTimeout(() => searchRef.current?.focus(), 30);
  }, []);

  // Suche mit Entprellung. Laufende Anfragen werden abgebrochen, damit eine langsame
  // frühere Antwort keine neuere überschreibt.
  //
  // Der Effekt setzt bewusst KEINEN State synchron: ob Treffer angezeigt werden, ergibt sich
  // weiter unten aus `query` und `order` (siehe visibleHits). Sonst würde jede Eingabe eine
  // zusätzliche Renderrunde auslösen.
  useEffect(() => {
    const trimmed = query.trim();
    if (order !== null || trimmed.length < 2) return;

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);

      fetch(`/api/distribution/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Suche fehlgeschlagen');
          return (await response.json()) as { results: SearchHit[] };
        })
        .then((data) => {
          setHits(data.results);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') return;
          setError('Die Suche ist gerade nicht erreichbar.');
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, order]);

  function selectOrder(orderId: string) {
    setNotice(null);
    setError(null);

    startTransition(async () => {
      const result = await loadOrderAction(orderId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOrder(result.order);
    });
  }

  const backToSearch = useCallback(() => {
    setOrder(null);
    setQuery('');
    setHits([]);
    setNotice(null);
    focusSearch();
  }, [focusSearch]);

  // Alles ausgegeben? Dann steht die Suche für die nächste Person automatisch bereit.
  useEffect(() => {
    if (order?.distributionStatus !== 'FULLY_DISTRIBUTED') return;

    const timer = window.setTimeout(backToSearch, RETURN_TO_SEARCH_MS);
    return () => window.clearTimeout(timer);
  }, [order?.distributionStatus, backToSearch]);

  function handleDistributeItem(itemId: string) {
    setNotice(null);
    startTransition(async () => {
      const result = await distributeItemAction(itemId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOrder(result.order);
      setNotice(result.notice);
    });
  }

  function handleDistributeAll() {
    if (!order) return;

    const open = order.items.filter((item) => item.distributionStatus !== 'DISTRIBUTED').length;
    if (open === 0) return;

    if (!window.confirm(`${open} Artikel für ${order.firstName} ${order.lastName} jetzt als ausgegeben markieren?`)) {
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const result = await distributeAllAction(order.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOrder(result.order);
      setNotice(result.notice);
    });
  }

  // Abgeleitet statt gespeichert: zu kurze Eingabe oder geöffnete Bestellung = keine Trefferliste.
  const visibleHits = order === null && query.trim().length >= 2 ? hits : [];

  if (order) {
    const distributed = order.items.filter((item) => item.distributionStatus === 'DISTRIBUTED').length;
    const allDone = distributed === order.items.length;

    return (
      <div className="space-y-5">
        <button type="button" onClick={backToSearch} className="btn-secondary h-12 px-4 text-base">
          ← Zurück zur Suche
        </button>

        <header className="surface-card rounded-2xl p-5">
          <p className="text-foreground text-3xl font-bold">
            {order.firstName} {order.lastName}
          </p>
          <p className="text-muted-foreground mt-2 font-mono text-base">Bestellung {order.orderNumber}</p>
          <p className="text-foreground mt-3 text-lg font-semibold">
            {distributed} von {order.items.length} Artikeln ausgegeben
          </p>
        </header>

        {notice ? (
          <p role="status" className="rounded-xl bg-amber-100 px-4 py-3 text-lg font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {notice}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-lg font-medium text-red-900 dark:bg-red-950 dark:text-red-100">
            {error}
          </p>
        ) : null}

        {allDone ? (
          <p role="status" className="rounded-xl bg-green-100 px-4 py-4 text-center text-xl font-bold text-green-900 dark:bg-green-950 dark:text-green-100">
            Alles ausgegeben – weiter zur nächsten Person
          </p>
        ) : null}

        <ul className="space-y-3">
          {order.items.map((item) => {
            const done = item.distributionStatus === 'DISTRIBUTED';

            return (
              <li
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 p-4 ${
                  done
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/40'
                    : 'border-border bg-card'
                }`}
              >
                <div className="min-w-40 flex-1">
                  <p className="text-foreground flex items-center gap-2 text-xl font-semibold">
                    <span aria-hidden="true" className={done ? 'text-green-600' : 'text-muted-foreground'}>
                      {done ? '✓' : '○'}
                    </span>
                    {item.quantity} × {item.productName}
                  </p>
                  <p className="text-muted-foreground mt-0.5 ml-7 text-lg">{item.variantLabel}</p>
                </div>

                {done ? (
                  <span className="px-2 text-lg font-bold tracking-wide text-green-700 uppercase dark:text-green-400">
                    Ausgegeben
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDistributeItem(item.id)}
                    disabled={pending}
                    className="btn-primary h-16 min-w-40 px-6 text-lg"
                  >
                    Ausgeben
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {!allDone ? (
          <button
            type="button"
            onClick={handleDistributeAll}
            disabled={pending}
            className="btn-primary h-20 w-full text-xl tracking-wide uppercase"
          >
            Alles ausgeben
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="suche" className="text-foreground mb-2 block text-lg font-semibold">
          Name eingeben
        </label>
        <input
          id="suche"
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="z. B. Max Mus"
          className="field-input h-16 text-2xl"
        />
        <p className="text-muted-foreground mt-2 text-sm">
          Vorname, Nachname oder Bestellnummer. Es werden nur bezahlte Bestellungen gefunden.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-lg font-medium text-red-900 dark:bg-red-950 dark:text-red-100">
          {error}
        </p>
      ) : null}

      {query.trim().length >= 2 && !searching && visibleHits.length === 0 ? (
        <p className="text-muted-foreground surface-card rounded-2xl px-4 py-8 text-center text-lg">
          Keine bezahlte Bestellung gefunden.
        </p>
      ) : null}

      <ul className="space-y-3">
        {visibleHits.map((hit) => {
          const complete = hit.distributedCount === hit.itemCount;

          return (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => selectOrder(hit.id)}
                disabled={pending}
                className="border-border bg-card hover:bg-muted flex w-full items-center justify-between gap-4 rounded-2xl border-2 p-5 text-left transition"
              >
                <span>
                  <span className="text-foreground block text-2xl font-semibold">
                    {hit.firstName} {hit.lastName}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-lg">
                    {hit.orderNumber}
                  </span>
                </span>

                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-base font-bold ${
                    complete
                      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {hit.distributedCount}/{hit.itemCount}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
