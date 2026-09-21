import Link from 'next/link';
import { AddToCart } from '@/components/shop/add-to-cart';
import { HoodieGallery, type GalleryImage } from '@/components/shop/hoodie-gallery';
import { OrderCountdown } from '@/components/shop/order-countdown';
import { OrderWindowBanner } from '@/components/shop/order-window-banner';
import { ProductImage } from '@/components/shop/product-image';
import { formatCents } from '@/lib/money';
import { listPublicProducts } from '@/server/shop/catalog';
import { evaluateOrderWindow, formatBerlinDateTime } from '@/server/shop/order-window';
import { getOrderWindow, getSettings } from '@/server/settings';

// Produkte und Bestellzeitraum ändern sich während der Bestellphase – nicht statisch cachen.
export const dynamic = 'force-dynamic';

/**
 * Die Startseite ist auf genau einen Artikel ausgelegt: den Abi-Hoodie. Das erste aktive
 * Produkt (niedrigster sortOrder) wird als Hauptartikel inszeniert und lässt sich direkt
 * hier bestellen – ohne Umweg über eine Produktliste.
 *
 * Das Datenmodell erlaubt weiterhin mehrere Produkte. Falls jemand im Adminbereich noch
 * etwas anlegt, erscheint es weiter unten als zusätzlicher Artikel, statt unsichtbar zu
 * werden. Die Seite bleibt damit ehrlich zu dem, was in der Datenbank steht.
 */

const GALLERY: GalleryImage[] = [
  { src: '/img/hoodie-front.webp', alt: 'Der Abi-Hoodie von vorne mit dem Brustprint', caption: 'Vorne' },
  { src: '/img/hoodie-back.webp', alt: 'Der Abi-Hoodie von hinten mit dem großen Abikropolis-Print', caption: 'Hinten' },
  { src: '/img/hoodie-detail.webp', alt: 'Nahaufnahme des Drucks', caption: 'Detail' },
];

const HIGHLIGHTS = [
  {
    title: 'Schwerer Stoff',
    text: 'Dicker, angerauter Baumwollmix. Kein dünner Werbeartikel, sondern ein Pulli, den man auch nach dem Abi noch trägt.',
  },
  {
    title: 'Print über den ganzen Rücken',
    text: 'Das Abikropolis-Motiv mit der Jahreszahl 2027 – großflächig gedruckt, nicht aufgebügelt.',
  },
  {
    title: 'Unisex-Schnitt',
    text: 'Fällt normal aus. Wer es lockerer mag, nimmt eine Größe größer – umtauschen geht bei einer Sammelbestellung nicht.',
  },
  {
    title: 'Eine Sammelbestellung',
    text: 'Alles geht in einem Rutsch zum Hersteller. Deshalb gibt es einen festen Bestellschluss und danach keine Nachbestellung.',
  },
];

const FAQ = [
  {
    question: 'Wird der Hoodie verschickt?',
    answer:
      'Nein. Es gibt keinen Versand. Der gesamte Jahrgang bestellt gemeinsam, und die Ausgabe findet in der Schule bei den Q-Sprechern statt.',
  },
  {
    question: 'Kann ich nach dem Bestellschluss noch bestellen?',
    answer:
      'Nein. Nach dem Bestellschluss geht die Sammelbestellung zum Hersteller. Danach lässt sich nichts mehr hinzufügen – auch keine einzelne Nachbestellung.',
  },
  {
    question: 'Was ist, wenn die Größe nicht passt?',
    answer:
      'Bei einer Sammelbestellung gibt es keinen Umtausch. Wenn du unsicher bist, miss vorher einen Pulli nach, den du gerne trägst, und orientiere dich daran.',
  },
  {
    question: 'Wie bezahle ich?',
    answer:
      'Direkt beim Bestellen über Stripe. Wir speichern in diesem Shop keine Zahlungsdaten – die liegen ausschließlich bei Stripe.',
  },
  {
    question: 'Woher weiß ich, dass meine Bestellung angekommen ist?',
    answer:
      'Nach der Zahlung bekommst du eine Bestätigung per E-Mail mit einem persönlichen Link. Über diesen Link siehst du jederzeit den Status deiner Bestellung.',
  },
];

export default async function ShopHomePage() {
  const [products, settings, window] = await Promise.all([
    listPublicProducts(),
    getSettings(),
    getOrderWindow(),
  ]);

  const status = evaluateOrderWindow(window);
  const [featured, ...otherProducts] = products;

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="bg-night relative overflow-hidden">
        {/* Dezenter Lichtschein hinter dem Print, damit das Motiv nicht im Schwarz versinkt. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 size-[34rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--color-brand-500), transparent)' }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 md:grid-cols-2 md:gap-6">
          <div>
            <p className="eyebrow text-gold-400">Abikropolis · Jahrgang 2027</p>
            <h1 className="font-display mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
              Der Hoodie
              <br />
              zum Abi.
            </h1>
            <p className="mt-5 max-w-md text-base text-white/70">
              Ein Pulli, ein Print, ein Jahrgang. Jetzt bestellen und online bezahlen – abgeholt
              wird in der Schule bei den Q-Sprechern.
            </p>

            {featured ? (
              <p className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-white">
                  {formatCents(featured.minPriceCents)}
                </span>
                {featured.minPriceCents !== featured.maxPriceCents ? (
                  <span className="text-sm text-white/50">
                    bis {formatCents(featured.maxPriceCents)}
                  </span>
                ) : null}
                <span className="text-sm text-white/50">inkl. MwSt.</span>
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#bestellen" className="btn-on-dark h-12 px-7 text-base">
                {status.isOpen ? 'Jetzt bestellen' : 'Zum Artikel'}
              </a>
              <a
                href="#ablauf"
                className="inline-flex h-12 items-center rounded-lg px-5 text-sm font-semibold text-white/80 transition hover:text-white"
              >
                So läuft es ab
              </a>
            </div>

            {status.isOpen && status.endAt ? (
              <div className="mt-10">
                <OrderCountdown
                  endAtIso={status.endAt.toISOString()}
                  deadlineLabel={formatBerlinDateTime(status.endAt)}
                />
              </div>
            ) : null}
          </div>

          <div className="flex justify-center md:justify-end">
            {/*
              Das Motiv ist auf hellem Stoff gedruckt, der Ausschnitt hat also einen weißen
              Hintergrund. Auf dem dunklen Hero wirkt das nur dann nicht wie ein Fehler,
              wenn es bewusst als gerahmtes Poster auftritt – deshalb Rahmen und Schatten.
            */}
            <div className="ring-gold-500/30 w-full max-w-md rounded-2xl p-2 shadow-2xl ring-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/print-back.webp"
                alt="Das Abikropolis-Motiv des Jahrgangs 2027"
                width={900}
                height={968}
                className="w-full rounded-xl"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Bestellen (Artikel) */}
      <section id="bestellen" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20">
        <div className="mb-8">
          <OrderWindowBanner status={status} closedNotice={window.closedNotice} />
        </div>

        {!featured ? (
          <p className="text-muted surface-card rounded-2xl px-4 py-12 text-center">
            Aktuell ist kein Artikel verfügbar.
          </p>
        ) : (
          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            <HoodieGallery images={GALLERY} />

            <div className="md:pt-2">
              <p className="eyebrow text-brand-600 dark:text-brand-400">Abi-Hoodie 2027</p>
              <h2 className="mt-3 text-3xl sm:text-4xl">{featured.name}</h2>
              <p className="text-strong mt-3 text-2xl font-semibold">
                {featured.minPriceCents === featured.maxPriceCents
                  ? formatCents(featured.minPriceCents)
                  : `${formatCents(featured.minPriceCents)} – ${formatCents(featured.maxPriceCents)}`}
              </p>

              {featured.description ? (
                <p className="text-muted mt-5 whitespace-pre-line">{featured.description}</p>
              ) : featured.summary ? (
                <p className="text-muted mt-5">{featured.summary}</p>
              ) : null}

              <div className="rule-gold my-7" />

              <AddToCart variants={featured.variants} disabled={!status.isOpen} />

              <p className="text-muted mt-6 flex items-start gap-2 text-sm">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.6 7-10a7 7 0 1 0-14 0c0 5.4 7 10 7 10Z" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
                Kein Versand – Abholung in der Schule bei den Q-Sprechern.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ Highlights */}
      <section className="bg-surface-muted border-line border-y">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="eyebrow text-brand-600 dark:text-brand-400">Das Produkt</p>
          <h2 className="mt-3 text-2xl sm:text-3xl">Worauf es beim Pulli ankommt</h2>

          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="surface-card rounded-2xl p-5">
                <h3 className="text-base">{item.title}</h3>
                <p className="text-muted mt-2 text-sm">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Ablauf */}
      <section id="ablauf" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20">
        <p className="eyebrow text-brand-600 dark:text-brand-400">Ablauf</p>
        <h2 className="mt-3 text-2xl sm:text-3xl">Von der Bestellung bis zum Pulli</h2>

        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['1', 'Aussuchen', 'Farbe und Größe wählen und in den Warenkorb legen.'],
            ['2', 'Bezahlen', 'Direkt beim Bestellen online bezahlen. Danach kommt die Bestätigung per E-Mail.'],
            ['3', 'Sammelbestellung', 'Nach dem Bestellschluss geht alles gemeinsam zum Hersteller.'],
            ['4', 'Abholen', 'Ausgabe in der Schule bei den Q-Sprechern. Es wird nichts verschickt.'],
          ].map(([step, title, text]) => (
            <li key={step} className="border-line relative border-t pt-5">
              <span className="bg-brand-600 font-display absolute -top-4 grid size-8 place-items-center rounded-lg text-sm font-extrabold text-white">
                {step}
              </span>
              <h3 className="mt-3 text-base">{title}</h3>
              <p className="text-muted mt-1.5 text-sm">{text}</p>
            </li>
          ))}
        </ol>

        {settings.pickupInfo ? (
          <div className="border-gold-500/50 bg-gold-500/10 mt-10 rounded-2xl border p-5 sm:p-6">
            <h3 className="text-base">Abholung</h3>
            <p className="text-normal mt-2 text-sm whitespace-pre-line">{settings.pickupInfo}</p>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------- Weitere Artikel (falls) */}
      {otherProducts.length > 0 ? (
        <section className="bg-surface-muted border-line border-y">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <p className="eyebrow text-brand-600 dark:text-brand-400">Außerdem</p>
            <h2 className="mt-3 text-2xl">Weitere Artikel</h2>

            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {otherProducts.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/produkte/${product.slug}`}
                    className="surface-card group block h-full overflow-hidden rounded-2xl transition hover:shadow-lg"
                  >
                    <ProductImage
                      imageId={product.imageId}
                      alt={product.name}
                      className="aspect-4/3 w-full object-cover"
                    />
                    <div className="p-4">
                      <h3 className="group-hover:text-brand-600 text-lg">{product.name}</h3>
                      {product.summary ? <p className="text-muted mt-1 text-sm">{product.summary}</p> : null}
                      <p className="text-strong mt-3 font-semibold">
                        {product.minPriceCents === product.maxPriceCents
                          ? formatCents(product.minPriceCents)
                          : `ab ${formatCents(product.minPriceCents)}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------- FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <p className="eyebrow text-brand-600 dark:text-brand-400">Fragen</p>
        <h2 className="mt-3 text-2xl sm:text-3xl">Häufig gefragt</h2>

        {/* <details> statt eigener Akkordeon-Logik: funktioniert auch ohne JavaScript. */}
        <div className="mt-8 space-y-3">
          {FAQ.map((entry) => (
            <details key={entry.question} className="surface-card group rounded-xl px-5 py-4">
              <summary className="text-strong flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {entry.question}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="text-muted size-5 shrink-0 transition group-open:rotate-45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="text-muted mt-3 text-sm">{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
