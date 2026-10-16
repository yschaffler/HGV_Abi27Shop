/**
 * Das Lorbeer-Emblem des Jahrgangs – dieselbe Marke, die vorne auf dem Hoodie steht.
 *
 * Bewusst als Inline-SVG und nicht als Bilddatei: So ist es bei jeder Groesse scharf, faerbt
 * sich ueber `currentColor` mit (auf Navy creme, auf Hell navy) und setzt "ABI 2027" in
 * derselben Schrift wie die Ueberschriften der Seite. Als <img> eingebunden wuerde die
 * Schrift im SVG nicht geladen und das Emblem je nach Geraet anders aussehen.
 *
 * Die Geometrie des Kranzes ist berechnet – zwei Kreisboegen mit einer aeusseren und einer
 * inneren Blattreihe – und deshalb exakt symmetrisch.
 */
export function AbiEmblem({ className = '', title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      fill="currentColor"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {/* Saeulenkapitell in der Oeffnung des Kranzes */}
      <g>
        <rect x="95" y="24" width="50" height="7" rx="2" />
        <rect x="100" y="33" width="40" height="5" rx="2" />
        <rect x="104" y="41" width="4" height="24" rx="1.5" />
        <rect x="112" y="41" width="4" height="24" rx="1.5" />
        <rect x="120" y="41" width="4" height="24" rx="1.5" />
        <rect x="128" y="41" width="4" height="24" rx="1.5" />
        <rect x="99" y="67" width="42" height="6" rx="2" />
      </g>

      {/* Lorbeerkranz: zwei Stiele mit aeusserer und innerer Blattreihe */}
      <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M 108.6 213.2 A 82 82 0 0 1 69.5 67.4" />
        <path d="M 131.4 213.2 A 82 82 0 0 0 170.5 67.4" />
      </g>

      <g>
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(108.7 212.2) rotate(218)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(101 192.1) rotate(215.6)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(83 204.1) rotate(237.1)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(82.3 182.5) rotate(234.7)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(61.5 188) rotate(256.3)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(67.9 167.4) rotate(253.9)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(46.3 165.7) rotate(275.4)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(59.1 148.3) rotate(273)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(39.4 139.7) rotate(294.6)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(57.2 127.4) rotate(292.1)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(41.3 112.8) rotate(313.7)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(62.1 107.1) rotate(311.3)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(52 88.1) rotate(332.9)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(73.5 89.5) rotate(330.4)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(70.1 68.2) rotate(352)" />
      </g>

      <g>
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(131.3 212.2) rotate(-38)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(139 192.1) rotate(-35.6)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(157 204.1) rotate(-57.1)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(157.7 182.5) rotate(-54.7)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(178.5 188) rotate(-76.3)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(172.1 167.4) rotate(-73.9)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(193.7 165.7) rotate(-95.4)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(180.9 148.3) rotate(-93)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(200.6 139.7) rotate(-114.6)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(182.8 127.4) rotate(-112.1)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(198.7 112.8) rotate(-133.7)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(177.9 107.1) rotate(-131.3)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(188 88.1) rotate(-152.9)" />
        <path d="M0 0 C 4.5 -5, 13 -5, 17.5 0 C 13 5, 4.5 5, 0 0 Z" transform="translate(166.5 89.5) rotate(-150.4)" />
        <path d="M0 0 C 7 -8, 21 -8, 28 0 C 21 8, 7 8, 0 0 Z" transform="translate(169.9 68.2) rotate(-172)" />
      </g>

      {/* Schriftzug – nutzt die Display-Schrift der Seite */}
      <text x="120" y="138" textAnchor="middle" className="font-display" fontSize="40" fontWeight="700" letterSpacing="2">
        ABI
      </text>
      <text x="120" y="178" textAnchor="middle" className="font-display" fontSize="33" fontWeight="600" letterSpacing="0.5">
        2027
      </text>
    </svg>
  );
}
