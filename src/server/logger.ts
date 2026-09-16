import 'server-only';
import { randomUUID } from 'node:crypto';

/**
 * Minimales strukturiertes Logging.
 *
 * Regel: technische Details bleiben im Serverlog, der Benutzer bekommt ausschließlich eine
 * verständliche Meldung und eine Fehler-ID, mit der man den Eintrag im Log wiederfindet.
 */

type Level = 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

/** Feldnamen, deren Werte niemals im Log landen dürfen. */
const REDACTED_KEYS = [
  'password',
  'passwordhash',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'signature',
  'totp',
  'databaseurl',
  'connectionstring',
];

function redact(fields: Fields): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
    if (REDACTED_KEYS.some((needle) => normalized.includes(needle))) {
      out[key] = '[redacted]';
    } else if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message, stack: value.stack };
    } else {
      out[key] = value;
    }
  }
  return out;
}

function write(level: Level, message: string, fields: Fields = {}): void {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...redact(fields),
  });

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  info: (message: string, fields?: Fields) => write('info', message, fields),
  warn: (message: string, fields?: Fields) => write('warn', message, fields),
  error: (message: string, fields?: Fields) => write('error', message, fields),
};

/**
 * Loggt einen unerwarteten Fehler und liefert eine kurze ID zurück, die dem Benutzer
 * angezeigt werden kann. Der Benutzer erfährt dadurch nichts über die Interna.
 */
export function logUnexpected(scope: string, error: unknown, fields: Fields = {}): string {
  const errorId = randomUUID().slice(0, 8);
  logger.error(`Unerwarteter Fehler in ${scope}`, {
    errorId,
    error: error instanceof Error ? error : new Error(String(error)),
    ...fields,
  });
  return errorId;
}
