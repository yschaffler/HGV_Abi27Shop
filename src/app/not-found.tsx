import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold tracking-widest text-brand-600 uppercase">404</p>
      <h1 className="text-2xl">Diese Seite gibt es nicht</h1>
      <p className="text-muted">
        Der Link ist vermutlich veraltet oder enthält einen Tippfehler.
      </p>
      <Link href="/" className="btn-primary mt-2">
        Zur Startseite
      </Link>
    </main>
  );
}
