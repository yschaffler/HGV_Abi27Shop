import type { Algorithm } from '@node-rs/argon2';

/**
 * Argon2id mit den OWASP-Referenzparametern (19 MiB Speicher, 2 Iterationen, Parallelitaet 1).
 *
 * Eigene Datei, damit Anwendung und Setup-Skript garantiert dieselben Parameter verwenden.
 * Der Algorithmuswert wird literal gesetzt: @node-rs/argon2 exportiert einen ambient
 * `const enum`, den TypeScript unter `isolatedModules` nicht zur Laufzeit aufloesen kann.
 */
export const ARGON2_OPTIONS = {
  /** Algorithm.Argon2id */
  algorithm: 2 satisfies Algorithm,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
