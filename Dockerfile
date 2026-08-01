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
# ENV does not survive across stages — re-declare the public Supabase config
# so the SERVER runtime sees it too (supabaseEnabled() reads process.env at
# request time; without this the app silently falls back to local JWT auth).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
COPY --from=builder /app ./
EXPOSE 3000
# Serve immediately — migrations run from the deploy workflows BEFORE the
# image rolls (fail-fast step), so a boot-time `migrate deploy` only added
# ~10s to every cold start. If you ever `fly deploy` by hand, run
# `npx prisma migrate deploy` yourself first. DATABASE_URL/DIRECT_URL/
# SESSION_SECRET/CRON_SECRET come from `fly secrets set`.
CMD ["npm", "run", "start"]
