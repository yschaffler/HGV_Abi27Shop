// Lädt .env, falls vorhanden – damit TEST_DATABASE_URL lokal nicht bei jedem Aufruf
// von Hand mitgegeben werden muss. Fehlt die Datei, passiert einfach nichts.
import 'dotenv/config';

/**
 * Feste Umgebung fuer alle Tests.
 *
 * Wichtig: Es werden ausschliesslich offensichtliche Test-Werte gesetzt. Es gibt keinen Pfad,
 * auf dem ein Test versehentlich gegen echte Stripe- oder Mail-Zugaenge laeuft.
 */
process.env['NODE_ENV'] = 'test';
process.env['AUTH_SECRET'] ??= 'test-secret-mit-mindestens-32-zeichen-laenge';
process.env['APP_URL'] ??= 'http://localhost:3000';
process.env['EMAIL_DRIVER'] = 'console';
process.env['STRIPE_SECRET_KEY'] ??= 'sk_test_dummy';
process.env['STRIPE_WEBHOOK_SECRET'] ??= 'whsec_test_dummy';
process.env['DATABASE_URL'] ??= process.env['TEST_DATABASE_URL'] ?? 'mysql://unused:unused@127.0.0.1:1/unused';
