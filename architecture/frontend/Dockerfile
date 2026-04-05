# ========================================
# 한경배달 Frontend - Multi-stage Dockerfile
# ========================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

# Stage 2: Build
FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BACKEND_URL=https://api.hankyeong.xyz

RUN mkdir -p public && npm run build

# Stage 3: Production
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV BACKEND_URL=https://api.hankyeong.xyz

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# standalone 출력 복사 (next.config.js에 output: 'standalone' 필요)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
