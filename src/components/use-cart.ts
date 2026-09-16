'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { cartItemCount, normalizeCart, readCart, writeCart, CART_STORAGE_KEY, type CartItem } from '@/lib/cart';
import { ORDER_LIMITS } from '@/lib/validation/order';

/**
 * Warenkorb als externer Store.
 *
 * localStorage ist aus Sicht von React ein externes System. Statt den Inhalt in einem Effekt
 * in einen State zu kopieren (was kaskadierende Renders auslöst), wird er über
 * useSyncExternalStore angebunden. Nebeneffekt: Es braucht keinen Context-Provider mehr,
 * jede Komponente kann den Warenkorb direkt lesen, und Änderungen in einem zweiten Tab
 * kommen über dasselbe Abo an.
 */

type CartSnapshot = {
  items: CartItem[];
  /** false, solange der Store noch nicht aus dem localStorage gelesen wurde. */
  ready: boolean;
};

/**
 * Beim ersten Render (Server und Hydration) ist der Warenkorb absichtlich leer: Der Server
 * kennt den localStorage nicht, und ein abweichender erster Client-Render wäre ein
 * Hydration-Fehler. Direkt nach dem Abonnieren liefert der Store den echten Inhalt nach.
 */
const EMPTY_SNAPSHOT: CartSnapshot = { items: [], ready: false };

let snapshot: CartSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function loadFromStorage(): void {
  snapshot = { items: readCart(), ready: true };
}

function handleStorageEvent(event: StorageEvent): void {
  if (event.key === null || event.key === CART_STORAGE_KEY) {
    loadFromStorage();
    emit();
  }
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    loadFromStorage();
    window.addEventListener('storage', handleStorageEvent);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', handleStorageEvent);
  };
}

function getSnapshot(): CartSnapshot {
  return snapshot;
}

function getServerSnapshot(): CartSnapshot {
  return EMPTY_SNAPSHOT;
}

function setItems(next: CartItem[]): void {
  snapshot = { items: normalizeCart(next), ready: true };
  writeCart(snapshot.items);
  emit();
}

export type UseCartResult = CartSnapshot & {
  count: number;
  add: (variantId: string, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

export function useCart(): UseCartResult {
  const { items, ready } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((variantId: string, quantity: number) => {
    setItems([...snapshot.items, { variantId, quantity }]);
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    const clamped = Math.max(0, Math.min(quantity, ORDER_LIMITS.maxQuantityPerLine));
    setItems(
      snapshot.items
        .map((item) => (item.variantId === variantId ? { ...item, quantity: clamped } : item))
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setItems(snapshot.items.filter((item) => item.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, ready, count: cartItemCount(items), add, setQuantity, remove, clear };
}
