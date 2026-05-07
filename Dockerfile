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

# Remove default nginx config
RUN rm /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Generate self-signed SSL certificates so the 443 listener works out of the box
RUN apk add --no-cache openssl \
 && openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
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

# Use envsubst to resolve $BACKEND_HOSTNAME in nginx.conf at container start
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_HOSTNAME}' < /etc/nginx/nginx.conf > /tmp/nginx.conf && mv /tmp/nginx.conf /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
