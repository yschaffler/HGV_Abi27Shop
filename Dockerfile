# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Abi-Shop – Produktions-Image
#
# Bewusst auf "bookworm-slim" (glibc) statt Alpine (musl): @node-rs/argon2 liefert fertige
# Binaries fuer debian-openssl-3.0.x. Mit Alpine muesste das nachgebaut werden.
#
# Das Laufzeit-Image enthaelt AUSSCHLIESSLICH den Server. Die Prisma-CLI liegt bewusst
# nicht darin: Ihr Abhaengigkeitsbaum ist rund 250 MB gross und enthaelt unter anderem
# Prisma Studio samt react-dom – Ballast, nur um Migrationen anzuwenden. Migrationen
# laufen stattdessen als eigener Schritt mit dem builder-Stage, siehe docker-compose.yml
# und den Abschnitt "Deployment" in der README.
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
