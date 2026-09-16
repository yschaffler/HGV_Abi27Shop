/**
 * Produktbild oder Platzhalter.
 *
 * Bilder werden über /api/media/<id> ausgeliefert – nicht direkt aus dem Dateisystem.
 * Der Route Handler setzt einen festen Content-Type und verhindert damit, dass eine
 * hochgeladene Datei jemals als etwas anderes als ein Bild interpretiert wird.
 */
export function ProductImage({
  imageId,
  alt,
  className = '',
}: {
  imageId: string | null;
  alt: string;
  className?: string;
}) {
  if (!imageId) {
    return (
      <div
        className={`grid place-items-center bg-surface-muted ${className}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="text-muted size-10" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16.5 8.5 12l3 3 3.5-3.5L20 16.5M4 5h16v14H4z" />
        </svg>
      </div>
    );
  }

  // Bewusst <img> statt next/image: Die Bilder kommen aus einem eigenen Route Handler,
  // die Optimierungspipeline von Next braucht es hier nicht und würde nur Komplexität
  // und einen weiteren Cache hinzufügen.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/media/${imageId}`} alt={alt} className={className} loading="lazy" decoding="async" />;
}
