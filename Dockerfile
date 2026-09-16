# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Abi-Shop – Produktions-Image
#
# Bewusst auf "bookworm-slim" (glibc) statt Alpine (musl): @node-rs/argon2 und die
# Prisma Schema Engine liefern fertige Binaries fuer debian-openssl-3.0.x. Mit Alpine
# muesste beides nachgebaut werden – mehr Aufwand, mehr das schiefgehen kann.
#
# Der Container bringt die Prisma-CLI mit und wendet beim Start ausstehende Migrationen an.
# Das macht das Image groesser (rund 500 MB), aber das Hosten besteht dafuer aus genau einem
# Schritt. Wer die Migrationen lieber selbst steuert, setzt RUN_MIGRATIONS=false.
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Abhaengigkeiten (inklusive Dev, weil der Build sie braucht) ------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Build -----------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Der Build laeuft ohne Produktions-Secrets: die Konfiguration wird erst zur Laufzeit
# eingelesen (siehe src/server/env.ts). Deshalb muss hier nichts Geheimes ins Image.
ENV NODE_ENV=production
RUN npm run build

# --- Laufzeit --------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/data/uploads

# Nicht als root laufen. node:22 bringt den Benutzer "node" (UID 1000) bereits mit.
RUN mkdir -p /app/data/uploads && chown -R node:node /app

# Next.js "standalone" enthaelt den Server samt der tatsaechlich benoetigten Module.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Fuer "prisma migrate deploy" beim Start: Schema, Migrationen und die Prisma-CLI.
# Prisma 7 liest die Datenbank-URL ausschliesslich aus der Config-Datei, deshalb muss
# auch prisma7.config.ts (und das darin importierte dotenv) mit ins Image.
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/node_modules/dotenv ./node_modules/dotenv

COPY --chown=node:node docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER node
EXPOSE 3000

# Der Healthcheck prueft ueber /api/health auch die Datenbankverbindung. Ein Container mit
# falscher DATABASE_URL faellt damit sofort auf und nicht erst bei der ersten Bestellung.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
