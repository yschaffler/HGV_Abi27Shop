import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { safeHref } from '@/lib/markdown';

/**
 * Rendert Markdown aus den Einstellungen (Impressum, Datenschutz, AGB, Widerruf).
 *
 * Sicherheit: react-markdown erzeugt React-Elemente, kein HTML-String. Es gibt hier
 * bewusst KEIN rehype-raw – rohes HTML im Text bleibt damit Text und wird nie als Markup
 * interpretiert. Ein <script> in den Einstellungen landet also sichtbar auf der Seite,
 * statt zu laufen. Die bisherige Eigenschaft der Klartextausgabe bleibt damit erhalten,
 * nur die Formatierung kommt dazu.
 *
 * Links werden zusätzlich auf unbedenkliche Protokolle beschränkt; alles andere
 * (javascript:, data: …) wird zu einem einfachen Textlink ohne Ziel.
 */

const COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="mt-10 mb-3 text-2xl first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-9 mb-3 text-xl first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-7 mb-2 text-base first:mt-0">{children}</h4>,
  h4: ({ children }) => (
    <p className="text-strong mt-6 mb-1 text-sm font-semibold first:mt-0">{children}</p>
  ),
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="text-strong font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-line my-8" />,
  blockquote: ({ children }) => (
    <blockquote className="border-brand-500 text-muted my-4 border-l-2 pl-4 italic">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-surface-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-surface-muted border-line my-4 overflow-x-auto rounded-lg border p-4 text-sm">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="border-line w-full border-collapse border text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-line bg-surface-muted text-strong border px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-line border px-3 py-2 align-top">{children}</td>,
  a: ({ href, children }) => {
    const target = safeHref(href);
    if (!target) return <span>{children}</span>;

    const isExternal = target.startsWith('http');
    return (
      <a
        href={target}
        className="text-brand-600 dark:text-brand-400 underline underline-offset-2 hover:no-underline"
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    );
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-normal">
      {/*
        remark-breaks macht aus einem einfachen Zeilenumbruch auch einen Umbruch in der
        Ausgabe. In reinem Markdown würde eine mehrzeilige Anschrift sonst zu einer einzigen
        Zeile zusammenlaufen – und genau so schreibt sie jeder, der ein Impressum einträgt.
      */}
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

