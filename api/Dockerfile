# HustleHub+ API: Node.js + Express served over HTTPS
FROM node:22-alpine

# openssl generates the self-signed certificate at container start
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only (cached unless package files change)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p certs logs && chown -R node:node certs logs && chmod +x docker-entrypoint.sh

# Run as the unprivileged "node" user, never root
USER node

EXPOSE 5001
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 CMD node healthcheck.js

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
