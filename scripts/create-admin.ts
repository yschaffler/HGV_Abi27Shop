/**
 * Legt einen Admin- oder Ausgabe-Benutzer an oder setzt dessen Passwort zurück.
 *
 *   npm run admin:create
 *   npm run admin:create -- --email=abi@example.de --name="Max Muster" --role=ADMIN
 *
 * Das Passwort wird nie als Kommandozeilenargument entgegengenommen – es stünde sonst in
 * der Shell-History und in der Prozessliste. Stattdessen wird es verdeckt abgefragt.
 * Der zweite Faktor wird beim ersten Login im Browser eingerichtet.
 */
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hash } from '@node-rs/argon2';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import type { Role } from '../src/generated/prisma/enums';
import { ARGON2_OPTIONS } from '../src/lib/argon2-params';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL fehlt');

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

/**
 * Eingaben.
 *
 * Im Terminal wird zeilenweise gefragt und die Passworteingabe verdeckt. Wenn stdin kein
 * Terminal ist (Setup-Skript, Container), wird stdin einmal komplett gelesen und
 * zeilenweise abgearbeitet – readline würde bei einem Pipe-Eingang alle Zeilen auf einmal
 * ausliefern und die späteren Antworten verwerfen.
 */
const interactive = Boolean(stdin.isTTY);

let pipedLines: string[] | null = null;

async function readPipedLines(): Promise<string[]> {
  if (pipedLines) return pipedLines;
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  pipedLines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
  return pipedLines;
}

async function nextPipedLine(question: string): Promise<string> {
  const lines = await readPipedLines();
  stdout.write(question);
  const value = lines.shift();
  if (value === undefined) throw new Error(`Keine Eingabe für: ${question.trim()}`);
  stdout.write('\n');
  return value;
}

async function prompt(question: string): Promise<string> {
  if (!interactive) return nextPipedLine(question);
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function promptHidden(question: string): Promise<string> {
  if (!interactive) return nextPipedLine(question);

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const originalWrite = stdout.write.bind(stdout);
  let muted = false;

  // Bewusster Eingriff in stdout, damit die Passworteingabe im Terminal nicht sichtbar ist.
  stdout.write = (chunk: string | Uint8Array, ...rest: unknown[]) => {
    if (muted && typeof chunk === 'string' && !chunk.includes('\n')) return true;
    return originalWrite(chunk as never, ...(rest as []));
  };

  try {
    const pending = rl.question(question);
    muted = true;
    const answer = await pending;
    muted = false;
    originalWrite('\n');
    return answer;
  } finally {
    muted = false;
    stdout.write = originalWrite;
    rl.close();
  }
}

async function main(): Promise<void> {
  const email = (argValue('email') ?? (await prompt('E-Mail: '))).trim().toLowerCase();
  const name = (argValue('name') ?? (await prompt('Name: '))).trim();
  const roleInput = (argValue('role') ?? (await prompt('Rolle [ADMIN|DISTRIBUTION] (ADMIN): '))).trim().toUpperCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Ungültige E-Mail-Adresse');
  if (name.length < 2) throw new Error('Name ist zu kurz');

  const role: Role = roleInput === 'DISTRIBUTION' ? 'DISTRIBUTION' : 'ADMIN';

  const password = await promptHidden('Passwort (min. 12 Zeichen): ');
  const repeat = await promptHidden('Passwort wiederholen: ');

  if (password.length < 12) throw new Error('Passwort muss mindestens 12 Zeichen haben');
  if (password !== repeat) throw new Error('Die Passwörter stimmen nicht überein');

  const passwordHash = await hash(password, ARGON2_OPTIONS);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { name, role, passwordHash, isActive: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    // Passwortwechsel meldet alle bestehenden Sessions ab.
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    stdout.write(`\nBenutzer ${email} aktualisiert (Rolle ${role}). Alle Sessions wurden beendet.\n`);
  } else {
    await prisma.user.create({ data: { email, name, role, passwordHash } });
    stdout.write(`\nBenutzer ${email} angelegt (Rolle ${role}).\n`);
  }

  if (role === 'ADMIN') {
    stdout.write('Beim ersten Login wird die Zwei-Faktor-Authentifizierung eingerichtet.\n');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(`\nFehler: ${error instanceof Error ? error.message : String(error)}`);
    await prisma.$disconnect();
    process.exit(1);
  });
