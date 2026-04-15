FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

# 모든 소스 먼저 복사 (prisma 포함)
COPY . .

# Prisma generate를 소스 복사 이후에 실행하여 캐시 문제 방지
RUN npx prisma generate
RUN npm run build

# ---

FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# [SECURITY] H-2: non-root 사용자로 실행
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app appuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
