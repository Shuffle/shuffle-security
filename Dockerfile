# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Optional: set a specific API URL at build time.
# If omitted, the frontend defaults to the current domain (same-origin),
# which works with the nginx reverse proxy for /api/v1 and /api/v2.
ARG VITE_SHUFFLE_API_URL
ENV VITE_SHUFFLE_API_URL=$VITE_SHUFFLE_API_URL

# Install dependencies (npm + package-lock.json is the standard build system)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Copy project nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# BACKEND_HOSTNAME is resolved at runtime via envsubst
ENV BACKEND_HOSTNAME=backend

EXPOSE 80 443

# Use envsubst to resolve $BACKEND_HOSTNAME in nginx.conf at container start
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_HOSTNAME}' < /etc/nginx/nginx.conf > /tmp/nginx.conf && mv /tmp/nginx.conf /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
