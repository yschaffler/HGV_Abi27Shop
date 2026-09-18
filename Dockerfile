# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Abi-Shop – Produktions-Image
#
# Bewusst auf "bookworm-slim" (glibc) statt Alpine (musl): @node-rs/argon2 liefert fertige
# Binaries fuer debian-openssl-3.0.x. Mit Alpine muesste das nachgebaut werden.
#
# Das Laufzeit-Image enthaelt AUSSCHLIESSLICH den Server. Die Prisma-CLI liegt bewusst
# nicht darin: Ihr Abhaengigkeitsbaum ist rund 250 MB gross und enthaelt unter anderem
# Prisma Studio samt react-dom – Ballast, nur um Migrationen anzuwenden.
#
# Migrationen laufen deshalb in einem eigenen Schritt. Dafuer gibt es zwei Wege:
#   - lokal: der builder-Stage (hat ohnehin alles), siehe docker-compose.yml
#   - Produktion: der migrator-Stage weiter unten, der als eigenes Image veroeffentlicht
#     wird, siehe docker-compose.prod.yml und docs/DEPLOYMENT.md
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Abhaengigkeiten (inklusive Dev, weil der Build sie braucht) ------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- Build -----------------------------------------------------------------
# Dieser Stage wird ausserdem direkt als Werkzeug-Image verwendet: fuer
# "prisma migrate deploy", zum Anlegen des ersten Admins und fuer den Seed.
# Er hat dafuer alles an Bord – Quellcode, Schema, Migrationen und die vollstaendigen
# Abhaengigkeiten.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Der Build laeuft ohne Produktions-Secrets: die Konfiguration wird erst zur Laufzeit
# eingelesen (siehe src/server/env.ts). Deshalb muss hier nichts Geheimes ins Image.
ENV NODE_ENV=production
RUN npm run build

# --- Migrationen -----------------------------------------------------------
# Eigenes, schlankes Image nur fuer "prisma migrate deploy".
#
# Bewusst nicht "npm ci --omit=dev": Das wuerde saemtliche Laufzeitabhaengigkeiten der
# Anwendung mitinstallieren (Next, React, Stripe ...), obwohl hier nur die CLI gebraucht
# wird. Installiert wird deshalb gezielt die Prisma-CLI – in genau der Version, die auch
# das Projekt verwendet. Die wird aus der package.json gelesen, damit beides beim
# naechsten Prisma-Update nicht auseinanderlaeuft.
FROM base AS migrator

# Kein Versions-Check nach aussen und keine Telemetrie aus einem Migrationscontainer.
ENV CHECKPOINT_DISABLE=1

COPY package.json ./
RUN PRISMA_VERSION="$(node -p "(require('./package.json').devDependencies.prisma || require('./package.json').dependencies.prisma).replace(/^[^0-9]*/, '')")" \
 && npm install --no-save --no-audit --no-fund --omit=dev "prisma@${PRISMA_VERSION}" dotenv \
 && npm cache clean --force

# Zuletzt kopiert, weil sich Schema und Migrationen oefter aendern als die CLI-Version –
# so bleibt die teure Installationsschicht im Cache.
COPY prisma7.config.ts ./
COPY prisma ./prisma

USER node

# Direkter Aufruf statt ueber npx: ein Prozess weniger und kein Suchpfad-Raten.
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

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

USER node
EXPOSE 3000

# Der Healthcheck prueft ueber /api/health auch die Datenbankverbindung. Ein Container mit
# falscher DATABASE_URL faellt damit sofort auf und nicht erst bei der ersten Bestellung.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Kein Startskript: weniger bewegliche Teile, und damit auch keine Stolperfallen durch
# Zeilenenden oder Dateirechte.
CMD ["node", "server.js"]
