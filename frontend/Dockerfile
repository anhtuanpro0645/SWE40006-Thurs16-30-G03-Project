# Web image: build the Vue app with Vite, then serve it with Nginx

# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Set by CI. Vite only exposes variables that start with VITE_ to the app.
ARG GIT_SHA=dev
ARG BUILD_TIME=
ENV VITE_GIT_SHA=$GIT_SHA \
    VITE_BUILD_TIME=$BUILD_TIME

RUN npm run build

# ---- Runtime stage ----
FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
