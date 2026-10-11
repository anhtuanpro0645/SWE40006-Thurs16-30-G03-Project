# API image: Node.js 22 + Express
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only. Copying the package files first lets
# Docker reuse this layer when only the source code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY db ./db

# Set by CI so /health can report which commit is running
ARG GIT_SHA=dev
ARG BUILD_TIME=
ENV NODE_ENV=production \
    PORT=3000 \
    GIT_SHA=$GIT_SHA \
    BUILD_TIME=$BUILD_TIME

# Do not run as root inside the container
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

CMD ["node", "src/server.js"]
