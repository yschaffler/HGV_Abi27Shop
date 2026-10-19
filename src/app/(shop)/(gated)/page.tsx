import {
  CalendarX2Icon,
  ExternalLinkIcon,
  HandCoinsIcon,
  LayersIcon,
  MapPinIcon,
  PrinterIcon,
  RulerIcon,
  UsersIcon,
} from 'lucide-react';
import { AbiEmblem } from '@/components/shop/abi-emblem';
import { OrderCountdown } from '@/components/shop/order-countdown';
import { OrderWindowBanner } from '@/components/shop/order-window-banner';
import { ProductShowcase } from '@/components/shop/product-showcase';
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
import { PRINT_PARTNER } from '@/lib/print-partner';
import { listPublicProducts, type PublicProduct } from '@/server/shop/catalog';
import { evaluateOrderWindow, formatBerlinDateTime } from '@/server/shop/order-window';
import { getOrderWindow, getSettings } from '@/server/settings';

// Produkte und Bestellzeitraum ändern sich während der Bestellphase – nicht statisch cachen.
export const dynamic = 'force-dynamic';

/**
 * Die Startseite ist die Kollektion des Jahrgangs: ein Design, zwei Teile – Hoodie und
 * Shirt. Jedes aktive Produkt steht hier vollständig mit Galerie und Bestellauswahl, ohne
 * Umweg über eine Produktliste. Was im Adminbereich aktiv ist, steht auf der Seite; die
 * Texte sind auf zwei Artikel geschrieben, die Darstellung käme aber auch mit einem oder
 * dreien zurecht.
 *
 * Die Bilder kommen aus dem Adminbereich. Für den Hero lässt sich unter Einstellungen ein
 * eigenes Cover hochladen; ohne Cover stehen dort die Titelbilder der Produkte (Produkte ›
 * Bilder), und solange auch davon keines da ist, das Mockup aus public/img.
 */

const HERO_FALLBACK = { src: '/img/hoodie-back.webp', width: 1000, height: 1908 };

const HIGHLIGHTS = [
  {
    icon: LayersIcon,
    title: 'Ein Design, zwei Teile',
    text: 'Hoodie und Shirt tragen denselben Abikropolis-Print. Nimm eins von beiden – oder beides in einer Bestellung.',
  },
  {
    icon: RulerIcon,
    title: 'Vorher anprobieren',
    text: 'Beide Modelle sind Oversize-Schnitte. Die Q-Sprecher haben Musterteile in der Schule – umtauschen geht bei einer Sammelbestellung nämlich nicht.',
  },
  {
    icon: PrinterIcon,
    title: `Gedruckt bei ${PRINT_PARTNER.name}`,
    text: `Bestellt und bedruckt wird alles bei ${PRINT_PARTNER.name}. Dort findet ihr auch die Details zu Stoff und Schnitt der Modelle.`,
  },
  {
    icon: UsersIcon,
    title: 'Ein Jahrgang, eine Bestellung',
    text: 'Die ganze Q13 bestellt gemeinsam. Deshalb gibt es einen festen Bestellschluss und danach keine Nachbestellung.',
  },
];

const STEPS = [
  { step: '1', title: 'Aussuchen', text: 'Hoodie, Shirt oder beides – Größe wählen und in den Warenkorb legen.' },
  { step: '2', title: 'Bezahlen', text: 'Direkt beim Bestellen online bezahlen. Danach kommt die Bestätigung per E-Mail.' },
  {
    step: '3',
    title: 'Sammelbestellung',
    text: `Nach dem Bestellschluss geht alles in einem Auftrag zu ${PRINT_PARTNER.name}.`,
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
      'Die gesamte Q13 bestellt als ein einziger Auftrag beim Textildrucker. Das macht Hoodie und Shirt für alle günstiger, bedeutet aber auch: Es gibt einen festen Bestellschluss, alle Größen gehen gemeinsam raus, und einzelne Änderungen sind danach nicht mehr möglich.',
  },
  {
    question: 'Kann ich Hoodie und Shirt zusammen bestellen?',
    answer:
      'Ja. Leg einfach beides in den Warenkorb – es wird eine Bestellung, eine Zahlung und eine Abholung.',
  },
  {
    question: 'Wer druckt die Sachen?',
    answer: `Bestellt und bedruckt wird bei ${PRINT_PARTNER.name}. Welches Modell es jeweils ist, steht beim Artikel; Details zu Stoff und Schnitt findet ihr auf der Seite von ${PRINT_PARTNER.name}.`,
  },
  {
    question: 'Wird etwas verschickt?',
    answer:
      'Nein. Es gibt keinen Versand. Die Ausgabe findet in der Schule bei den Q-Sprechern statt, sobald die Lieferung da ist.',
  },
  {
    question: 'Kann ich nach dem Bestellschluss noch bestellen?',
    answer:
      'Nein. Nach dem Bestellschluss geht die Sammelbestellung zum Drucker. Danach lässt sich nichts mehr hinzufügen – auch keine einzelne Nachbestellung.',
  },
  {
    question: 'Kann ich die Größen vorher anprobieren?',
    answer:
      'Ja. Die Q-Sprecher haben Musterteile in der Schule – sprecht sie an oder schreibt im Abichat, dann findet sich ein Termin. Das lohnt sich besonders, weil beide Modelle Oversize-Schnitte sind und ein Umtausch bei einer Sammelbestellung nicht möglich ist.',
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

/**
 * Bilder für den Hero: das eigene Cover aus den Einstellungen, sonst die Titelbilder der
 * Artikel – höchstens zwei, sonst wird es unruhig.
 */
function heroImages(heroImageId: string | null, products: PublicProduct[]) {
  if (heroImageId) return [{ src: `/api/media/${heroImageId}`, alt: 'Abikropolis-Kollektion' }];

  return products
    .flatMap((product) => {
      const cover = product.images[0];
      return cover ? [{ src: `/api/media/${cover.mediaId}`, alt: product.name }] : [];
    })
    .slice(0, 2);
}

export default async function ShopHomePage() {
  const [products, settings, window] = await Promise.all([
    listPublicProducts(),
    getSettings(),
    getOrderWindow(),
  ]);

  const status = evaluateOrderWindow(window);
  const covers = heroImages(settings.heroImageId, products);
  const lowestPrice = products.length > 0 ? Math.min(...products.map((product) => product.minPriceCents)) : null;
  const pricesDiffer = products.some(
    (product) => product.minPriceCents !== lowestPrice || product.maxPriceCents !== lowestPrice,
  );

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="bg-night relative overflow-hidden">
        {/* Dezenter Lichtschein hinter den Bildern, damit Navy auf Navy nicht flach wirkt. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 right-0 size-[36rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--color-navy-500), transparent)' }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 md:grid-cols-2 md:gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="ink-dark">Sammelbestellung</Badge>
              <span className="eyebrow text-creme-300/50">Q13 · HGV</span>
            </div>

            <h1 className="font-display text-creme-200 mt-5 text-6xl leading-[0.95] tracking-[0.03em] sm:text-8xl">
              Abikropolis
            </h1>
            <p className="font-display text-creme-300/70 mt-3 text-base tracking-[0.22em] sm:text-xl">
              Die Götter verlassen den Olymp
            </p>
            <p className="text-creme-300/70 mt-5 max-w-md text-base">
              Ein Print, zwei Teile, ein Jahrgang. Hoodie oder Shirt – die Q13 bestellt
              gemeinsam, du bezahlst online und holst alles in der Schule bei den Q-Sprechern ab.
            </p>

            {lowestPrice !== null ? (
              <p className="mt-6 flex flex-wrap items-baseline gap-2">
                {pricesDiffer ? <span className="text-creme-300/60 text-sm">ab</span> : null}
                <span className="font-display text-creme-200 text-4xl leading-none">{formatCents(lowestPrice)}</span>
                <span className="text-creme-300/50 text-sm">inkl. MwSt., kein Versand</span>
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="ink" size="xl">
                <a href="#kollektion">{status.isOpen ? 'Jetzt bestellen' : 'Zur Kollektion'}</a>
              </Button>
              <Button asChild variant="ghost" size="xl" className="text-creme-300/80 hover:bg-creme-300/10 hover:text-creme-100">
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

          {/*
            Die Höhenbegrenzung hält den Hero auf dem Laptop in einer Bildschirmhöhe. Bei
            zwei Artikeln steht das zweite Titelbild etwas kleiner daneben.
          */}
          <div className="flex items-end justify-center gap-4 md:justify-end">
            {covers.length === 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={HERO_FALLBACK.src}
                alt=""
                width={HERO_FALLBACK.width}
                height={HERO_FALLBACK.height}
                className="max-h-[30rem] w-auto drop-shadow-2xl"
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              covers.map((cover, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={cover.src}
                  src={cover.src}
                  alt={cover.alt}
                  className={`min-w-0 rounded-2xl object-contain drop-shadow-2xl ${
                    covers.length === 1
                      ? 'max-h-[30rem] w-auto max-w-full'
                      : index === 0
                        ? 'max-h-[30rem] w-auto max-w-[60%]'
                        : 'max-h-[21rem] w-auto max-w-[40%]'
                  }`}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  decoding="async"
                />
              ))
            )}
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
              text: `Die ganze Q13 bestellt zusammen bei ${PRINT_PARTNER.name}.`,
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

      {/* ------------------------------------------------------------ Kollektion */}
      <section id="kollektion" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20">
        <div className="flex items-center gap-4">
          <AbiEmblem className="text-foreground h-14 w-14 shrink-0" />
          <div>
            <p className="eyebrow text-primary">Die Kollektion</p>
            <h2 className="mt-1 text-2xl sm:text-3xl">Ein Design, zwei Teile</h2>
          </div>
        </div>

        <div className="mt-8">
          <OrderWindowBanner status={status} closedNotice={window.closedNotice} />
        </div>

        {products.length === 0 ? (
          <Card className="mt-8">
            <CardContent className="text-muted-foreground py-12 text-center">
              Aktuell ist kein Artikel verfügbar.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-10 space-y-16 sm:space-y-24">
            {products.map((product, index) => (
              <article key={product.id} id={product.slug} className="scroll-mt-20">
                {index > 0 ? <div className="rule text-foreground mb-16 sm:mb-24" /> : null}
                <ProductShowcase
                  product={product}
                  orderingOpen={status.isOpen}
                  sizeAdvice={settings.sizeAdvice}
                  reverse={index % 2 === 1}
                />
              </article>
            ))}
          </div>
        )}

        {/*
          Bewusst als Fußnote unter der Kollektion: Die Info gehört zum Preis, soll aber nicht
          mit Bestellschluss und Abholung um Aufmerksamkeit konkurrieren.
        */}
        <p className="text-muted-foreground mx-auto mt-16 max-w-xl text-center text-xs leading-relaxed">
          Die Preise dienen der Finanzierung der Sammelbestellung. Ein Aufschlag zur
          Gewinnerzielung ist nicht vorgesehen.
        </p>
      </section>

      {/* ------------------------------------------------------------ Highlights */}
      <section className="border-border border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="eyebrow text-primary">Gut zu wissen</p>
          <h2 className="mt-3 text-2xl sm:text-3xl">Bevor du bestellst</h2>

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

          {/*
            Der Drucker mit den bestellten Modellen. Die Modellnamen kommen aus dem
            Adminbereich, damit hier nichts Falsches steht, wenn sich das Modell ändert.
          */}
          <div className="border-border bg-card mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
            <div className="text-sm">
              <p className="text-foreground font-semibold">Gedruckt von {PRINT_PARTNER.name}</p>
              {products.some((product) => product.model) ? (
                <ul className="text-muted-foreground mt-1 space-y-0.5">
                  {products
                    .filter((product) => product.model)
                    .map((product) => (
                      <li key={product.id}>
                        {product.name}: <span className="text-foreground">{product.model}</span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
            <Button asChild variant="outline">
              <a href={PRINT_PARTNER.url} target="_blank" rel="noopener noreferrer">
                Modelle bei {PRINT_PARTNER.name} ansehen
                <ExternalLinkIcon aria-hidden="true" />
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Ablauf */}
      <section id="ablauf" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20">
        <p className="eyebrow text-primary">Ablauf</p>
        <h2 className="mt-3 text-2xl sm:text-3xl">Von der Bestellung bis zur Abholung</h2>

        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <li key={item.step} className="border-border relative border-t pt-5">
              <span className="bg-primary text-primary-foreground font-display absolute -top-4 grid size-8 place-items-center rounded-lg text-lg leading-none">
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
