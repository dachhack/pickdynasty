# Epic Pick'em — Fly.io image (same provider stack as the Drip pilot worker).
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time public env (baked into the client bundle). Pass via
# `fly deploy --build-arg NEXT_PUBLIC_SUPABASE_URL=... `.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app ./
EXPOSE 3000
# Apply pending migrations, then serve. DATABASE_URL/DIRECT_URL/SESSION_SECRET/
# CRON_SECRET come from `fly secrets set`.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
