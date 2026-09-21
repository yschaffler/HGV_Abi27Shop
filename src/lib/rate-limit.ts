/**
 * Fixed-Window Rate Limiting im Prozessspeicher.
 *
 * Dimensionierung: ein Jahrgang, ca. 160-300 Bestellungen, eine einzige Container-Instanz.
 * Dafür ist ein In-Memory-Zähler die richtige Lösung – Redis wäre zusätzliche
 * Infrastruktur ohne Nutzen. Wenn der Shop jemals auf mehrere Instanzen skaliert, muss
 * dieses Modul durch einen gemeinsamen Speicher ersetzt werden; das ist der einzige Ort,
 * an dem das angepasst werden muss. Ergänzend gibt es einen persistenten Login-Lockout
 * am Benutzerdatensatz, der einen Neustart überlebt.
 */

export type RateLimitRule = {
  /** Erlaubte Anfragen pro Fenster. */
  limit: number;
  /** Fensterlänge in Millisekunden. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Obergrenze, damit ein Angreifer den Speicher nicht mit Millionen Schlüsseln füllt. */
const MAX_TRACKED_KEYS = 50_000;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: rule.limit - existing.count, retryAfterSeconds: 0 };
}

/** Nach erfolgreichem Login zurücksetzen, damit ein Tippfehler nicht nachwirkt. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Nur für Tests. */
export function clearAllRateLimits(): void {
  buckets.clear();
}

export const RATE_LIMITS = {
  /** Anmeldeversuche je IP. */
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Anmeldeversuche je E-Mail-Adresse – bremst verteilte Angriffe auf ein Konto. */
  loginPerAccount: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** Bestellvorgänge je IP. */
  checkout: { limit: 8, windowMs: 10 * 60 * 1000 },
  /** Aufrufe der Bestellseite – bremst das Durchprobieren von Tokens zusätzlich ab. */
  orderLookup: { limit: 60, windowMs: 5 * 60 * 1000 },
  /** Autocomplete an der Ausgabe: häufig, aber nicht unbegrenzt. */
  distributionSearch: { limit: 120, windowMs: 60 * 1000 },
  /** Ausgabe-Aktionen je Benutzer. */
  distributionAction: { limit: 300, windowMs: 60 * 1000 },
  /** Bestätigungsmails je Empfänger. */
  email: { limit: 5, windowMs: 60 * 60 * 1000 },
  /**
   * Zugangscode je IP. Eng gesetzt: Ein kurzer, im Chat geteilter Code hat wenig
   * Entropie, deshalb ist die Bremse hier der eigentliche Schutz.
   */
  accessCode: { limit: 10, windowMs: 10 * 60 * 1000 },
  /** Exporte – erzeugen Last auf der Datenbank. */
  export: { limit: 30, windowMs: 10 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;
