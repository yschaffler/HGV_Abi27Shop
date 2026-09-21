import Link from 'next/link';
import {
  CalendarX2Icon,
  HandCoinsIcon,
  MapPinIcon,
  PackageIcon,
  RulerIcon,
  ShirtIcon,
  UsersIcon,
} from 'lucide-react';
import { AddToCart } from '@/components/shop/add-to-cart';
import { HoodieGallery, type GalleryImage } from '@/components/shop/hoodie-gallery';
import { OrderCountdown } from '@/components/shop/order-countdown';
import { OrderWindowBanner } from '@/components/shop/order-window-banner';
import { ProductImage } from '@/components/shop/product-image';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCents } from '@/lib/money';
import { listPublicProducts } from '@/server/shop/catalog';
import { evaluateOrderWindow, formatBerlinDateTime } from '@/server/shop/order-window';
import { getOrderWindow, getSettings } from '@/server/settings';

// Produkte und Bestellzeitraum ändern sich während der Bestellphase – nicht statisch cachen.
export const dynamic = 'force-dynamic';

/**
 * Die Startseite ist auf genau einen Artikel ausgelegt: den Abi-Hoodie der Q13. Das erste
 * aktive Produkt (niedrigster sortOrder) wird als Hauptartikel inszeniert und lässt sich
 * direkt hier bestellen – ohne Umweg über eine Produktliste.
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
    icon: ShirtIcon,
    title: 'Schwerer Stoff',
    text: 'Dicker, angerauter Baumwollmix. Kein dünner Werbeartikel, sondern ein Pulli, den man auch nach dem Abi noch trägt.',
  },
  {
    icon: PackageIcon,
    title: 'Print über den ganzen Rücken',
    text: 'Das Abikropolis-Motiv mit der Jahreszahl 2027 – großflächig gedruckt, nicht aufgebügelt.',
  },
  {
    icon: RulerIcon,
    title: 'Unisex-Schnitt',
    text: 'Fällt normal aus. Wer es lockerer mag, nimmt eine Größe größer – umtauschen geht bei einer Sammelbestellung nicht.',
  },
  {
    icon: UsersIcon,
    title: 'Ein Jahrgang, eine Bestellung',
    text: 'Die ganze Q13 bestellt gemeinsam. Deshalb gibt es einen festen Bestellschluss und danach keine Nachbestellung.',
  },
];

const STEPS = [
  { step: '1', title: 'Aussuchen', text: 'Farbe und Größe wählen und in den Warenkorb legen.' },
  { step: '2', title: 'Bezahlen', text: 'Direkt beim Bestellen online bezahlen. Danach kommt die Bestätigung per E-Mail.' },
  {
    step: '3',
    title: 'Sammelbestellung',
    text: 'Nach dem Bestellschluss geht alles in einem Auftrag zum Hersteller.',
  },
  {
    step: '4',
    title: 'Abholen',
    text: 'Ausgabe in der Schule bei den Q-Sprechern. Es wird nichts verschickt.',
  },
];

const FAQ = [
  {
    question: 'Was heißt hier Sammelbestellung?',
    answer:
      'Die gesamte Q13 bestellt als ein einziger Auftrag beim Hersteller. Das macht den Pulli für alle günstiger, bedeutet aber auch: Es gibt einen festen Bestellschluss, alle Größen gehen gemeinsam raus, und einzelne Änderungen sind danach nicht mehr möglich.',
  },
  {
    question: 'Wird der Hoodie verschickt?',
    answer:
      'Nein. Es gibt keinen Versand. Die Ausgabe findet in der Schule bei den Q-Sprechern statt, sobald die Lieferung da ist.',
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
          className="pointer-events-none absolute -top-24 right-0 size-[34rem] rounded-full opacity-[0.14] blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--color-brand-500), transparent)' }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 md:grid-cols-2 md:gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="gold" className="text-gold-200">
                Sammelbestellung
              </Badge>
              <span className="eyebrow text-white/50">Q13 · HG Vaterstetten</span>
            </div>

            <h1 className="font-display mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
              Der Hoodie
              <br />
              zum Abi.
            </h1>
            <p className="mt-5 max-w-md text-base text-white/70">
              Ein Pulli, ein Print, ein Jahrgang. Die Q13 bestellt gemeinsam – du bezahlst online
              und holst deinen Hoodie in der Schule bei den Q-Sprechern ab.
            </p>

            {featured ? (
              <p className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-white">
                  {formatCents(featured.minPriceCents)}
                </span>
                {featured.minPriceCents !== featured.maxPriceCents ? (
                  <span className="text-sm text-white/50">bis {formatCents(featured.maxPriceCents)}</span>
                ) : null}
                <span className="text-sm text-white/50">inkl. MwSt., kein Versand</span>
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="gold" size="xl">
                <a href="#bestellen">{status.isOpen ? 'Jetzt bestellen' : 'Zum Artikel'}</a>
              </Button>
              <Button asChild variant="ghost" size="xl" className="text-white/80 hover:bg-white/10 hover:text-white">
                <a href="#ablauf">So läuft es ab</a>
              </Button>
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
            <div className="ring-gold-500/25 w-full max-w-md rounded-2xl p-2 shadow-lg ring-1">
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

      {/* ------------------------------------------- Was eine Sammelbestellung heisst */}
      <section className="border-border border-b bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3">
          {[
            {
              icon: UsersIcon,
              title: 'Ein Auftrag für alle',
              text: 'Die ganze Q13 bestellt zusammen beim Hersteller.',
            },
            {
              icon: CalendarX2Icon,
              title: 'Fester Bestellschluss',
              text: 'Danach keine Nachbestellung und kein Umtausch.',
            },
            {
              icon: MapPinIcon,
              title: 'Abholung in der Schule',
              text: 'Ausgabe bei den Q-Sprechern, kein Versand.',
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <item.icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-foreground text-sm font-semibold">{item.title}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- Bestellen (Artikel) */}
      <section id="bestellen" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20">
        <div className="mb-8">
          <OrderWindowBanner status={status} closedNotice={window.closedNotice} />
        </div>

        {!featured ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center">
              Aktuell ist kein Artikel verfügbar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            <HoodieGallery images={GALLERY} />

            <div className="md:pt-2">
              <Badge variant="gold">Sammelbestellung der Q13</Badge>
              <h2 className="mt-3 text-3xl sm:text-4xl">{featured.name}</h2>
              <p className="text-foreground mt-3 text-2xl font-semibold">
                {featured.minPriceCents === featured.maxPriceCents
                  ? formatCents(featured.minPriceCents)
                  : `${formatCents(featured.minPriceCents)} – ${formatCents(featured.maxPriceCents)}`}
              </p>

              {featured.description ? (
                <p className="text-muted-foreground mt-5 whitespace-pre-line">{featured.description}</p>
              ) : featured.summary ? (
                <p className="text-muted-foreground mt-5">{featured.summary}</p>
              ) : null}

              <div className="rule-gold my-7" />

              <AddToCart variants={featured.variants} disabled={!status.isOpen} />

              <p className="text-muted-foreground mt-6 flex items-start gap-2 text-sm">
                <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Kein Versand – Abholung in der Schule bei den Q-Sprechern.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ Highlights */}
      <section className="border-border border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="eyebrow text-primary">Das Produkt</p>
          <h2 className="mt-3 text-2xl sm:text-3xl">Worauf es beim Pulli ankommt</h2>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((item) => (
              <Card key={item.title} className="gap-3 py-5">
                <CardHeader className="px-5">
                  <item.icon className="text-primary size-5" aria-hidden="true" />
                  <CardTitle className="mt-2 text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground px-5 text-sm">{item.text}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Ablauf */}
      <section id="ablauf" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20">
        <p className="eyebrow text-primary">Ablauf</p>
        <h2 className="mt-3 text-2xl sm:text-3xl">Von der Bestellung bis zum Pulli</h2>

        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <li key={item.step} className="border-border relative border-t pt-5">
              <span className="bg-primary text-primary-foreground font-display absolute -top-4 grid size-8 place-items-center rounded-lg text-sm font-extrabold">
                {item.step}
              </span>
              <h3 className="mt-3 text-base">{item.title}</h3>
              <p className="text-muted-foreground mt-1.5 text-sm">{item.text}</p>
            </li>
          ))}
        </ol>

        {settings.pickupInfo ? (
          <Alert variant="warning" className="mt-10">
            <HandCoinsIcon aria-hidden="true" />
            <AlertTitle>Abholung</AlertTitle>
            <AlertDescription>
              <p className="whitespace-pre-line">{settings.pickupInfo}</p>
            </AlertDescription>
          </Alert>
        ) : null}
      </section>

      {/* ------------------------------------------------- Weitere Artikel (falls) */}
      {otherProducts.length > 0 ? (
        <section className="border-border border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <p className="eyebrow text-primary">Außerdem</p>
            <h2 className="mt-3 text-2xl">Weitere Artikel</h2>

            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {otherProducts.map((product) => (
                <li key={product.id}>
                  <Link href={`/produkte/${product.slug}`} className="group block h-full">
                    <Card className="h-full gap-0 overflow-hidden py-0 transition group-hover:shadow-md">
                      <ProductImage
                        imageId={product.imageId}
                        alt={product.name}
                        className="aspect-4/3 w-full object-cover"
                      />
                      <CardContent className="p-4">
                        <h3 className="group-hover:text-primary text-lg">{product.name}</h3>
                        {product.summary ? (
                          <p className="text-muted-foreground mt-1 text-sm">{product.summary}</p>
                        ) : null}
                        <p className="text-foreground mt-3 font-semibold">
                          {product.minPriceCents === product.maxPriceCents
                            ? formatCents(product.minPriceCents)
                            : `ab ${formatCents(product.minPriceCents)}`}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------- FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <p className="eyebrow text-primary">Fragen</p>
        <h2 className="mt-3 text-2xl sm:text-3xl">Häufig gefragt</h2>

        <Accordion type="single" collapsible className="mt-6 w-full">
          {FAQ.map((entry, index) => (
            <AccordionItem key={entry.question} value={`faq-${index}`}>
              <AccordionTrigger>{entry.question}</AccordionTrigger>
              <AccordionContent>{entry.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
