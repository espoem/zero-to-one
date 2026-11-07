# Illustrative production image for a Node 26 service (module 14 §3). Built and run only by hand or in
# the integration environment; nothing in `npm test` depends on Docker.
# syntax=docker/dockerfile:1

FROM node:26.13.0-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# exact lockfile, no dev dependencies, no install scripts
RUN npm ci --omit=dev --ignore-scripts

FROM node:26.13.0-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node src ./src
# never run as root
USER node
EXPOSE 8080
# exec form: node receives signals directly; run the container with --init (or tini) as PID 1
CMD ["node", "--enable-source-maps", "--max-old-space-size-percentage=60", "src/server.js"]
