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

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

CMD ["node", "dist/server.js"]
