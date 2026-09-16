// Lädt .env, falls vorhanden – damit TEST_DATABASE_URL lokal nicht bei jedem Aufruf
// von Hand mitgegeben werden muss. Fehlt die Datei, passiert einfach nichts.
import 'dotenv/config';

/**
 * Feste Umgebung für alle Tests.
 *
 * Wichtig: Es werden ausschliesslich offensichtliche Test-Werte gesetzt. Es gibt keinen Pfad,
 * auf dem ein Test versehentlich gegen echte Stripe- oder Mail-Zugänge läuft.
 *
 * Der Umweg über `Record` ist nötig, weil @types/node NODE_ENV als schreibgeschützt
 * deklariert – in einer Testumgebung ist das Setzen aber genau richtig.
 */
const testEnv = process.env as Record<string, string | undefined>;

testEnv['NODE_ENV'] = 'test';
testEnv['AUTH_SECRET'] ??= 'test-secret-mit-mindestens-32-zeichen-laenge';
testEnv['APP_URL'] ??= 'http://localhost:3000';
testEnv['EMAIL_DRIVER'] = 'console';
testEnv['STRIPE_SECRET_KEY'] ??= 'sk_test_dummy';
testEnv['STRIPE_WEBHOOK_SECRET'] ??= 'whsec_test_dummy';
testEnv['DATABASE_URL'] ??= testEnv['TEST_DATABASE_URL'] ?? 'mysql://unused:unused@127.0.0.1:1/unused';
