# Stage 1: Build
FROM oven/bun:1-alpine AS build

WORKDIR /app

ARG VITE_SHUFFLE_API_URL
ENV VITE_SHUFFLE_API_URL=$VITE_SHUFFLE_API_URL

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# openssl is required to generate the self-signed certificate at container start
RUN apk add --no-cache openssl

# Remove default nginx config
RUN rm /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Bake a self-signed certificate into the image so the 443 listener works out of the box.
# It is regenerated at container start as well (see CMD) in case /etc/nginx is overlaid by a volume mount.
RUN openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/privkey.pem \
      -out /etc/nginx/fullchain.cert.pem \
      -subj "/CN=localhost"

# Copy project nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# BACKEND_HOSTNAME is resolved at runtime via envsubst
ENV BACKEND_HOSTNAME=backend

EXPOSE 80 443

# At container start:
#   1. Ensure a self-signed cert exists (regenerate if missing — e.g. when /etc/nginx is volume-mounted).
#   2. Resolve $BACKEND_HOSTNAME in nginx.conf via envsubst.
#   3. Launch nginx in the foreground.
CMD ["/bin/sh", "-c", "\
  if [ ! -f /etc/nginx/fullchain.cert.pem ] || [ ! -f /etc/nginx/privkey.pem ]; then \
    echo 'Generating self-signed TLS certificate for nginx...'; \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/privkey.pem \
      -out /etc/nginx/fullchain.cert.pem \
      -subj '/CN=localhost'; \
  fi && \
  envsubst '$${BACKEND_HOSTNAME}' < /etc/nginx/nginx.conf > /tmp/nginx.conf && \
  mv /tmp/nginx.conf /etc/nginx/nginx.conf && \
  nginx -g 'daemon off;'"]
