

# ---------- Stage 1: Build del Frontend ----------
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --silent

COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build -- --outDir /app/public


# ---------- Stage 2: Imagen de Producción ----------
FROM node:18-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --silent || npm install --omit=dev --silent

COPY server.js ./
COPY src/ ./src/
COPY config/ ./config/
COPY database/ ./database/

COPY --from=frontend-build /app/public ./public/

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
