# syntax=docker/dockerfile:1
# Knife Deagle Fight — single-image production build.
# Client is built in the builder stage; the runner serves client/dist
# from the Node process (server/src/index.js auto-detects ./client/dist).

FROM node:22-alpine AS build

WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client --ignore-scripts
COPY client ./client
COPY shared ./shared
# Vite outputs to client/dist (shared/ must be present — client sources
# import "../../../../shared/constants.js")
RUN npm run build --prefix client

FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Production server dependencies only
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/client/dist ./client/dist
COPY server ./server
COPY shared ./shared

# Run as non-root
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:3001/socket.io/?EIO=4&transport=polling" || exit 1

CMD ["node", "server/src/index.js"]
