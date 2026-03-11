# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Accept build-time API URL (defaults to production)
ARG VITE_SHUFFLE_API_URL=https://shuffler.io
ENV VITE_SHUFFLE_API_URL=$VITE_SHUFFLE_API_URL

# Install dependencies
COPY package.json bun.lock* package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
