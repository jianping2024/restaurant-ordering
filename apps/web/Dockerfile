# Mesa web — production image (Next.js standalone)
# Build from repo root:
#   docker build -f apps/web/Dockerfile -t mesa-web:local .

# Print-agent download panel: without this repo the dashboard hides the download
# card entirely (getPrintAgentDownloadUrls returns null). Single default here;
# per-stage ARG below inherits it.
ARG NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO=jianping2024/restaurant-ordering

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
# BuildKit cache: survives failed/partial npm ci and lock churn (layer CACHED alone does not).
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web apps/web
COPY packages/shared packages/shared
COPY packages/ui packages/ui
# Pinned print-agent version for download links (read via fs at runtime too).
COPY apps/print-agent/VERSION apps/print-agent/VERSION
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DOCKER_BUILD=1
# Browser URL: with SAME_ORIGIN=1 the client uses window.location.origin at runtime.
ARG NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
ARG NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN=1
ARG NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN=$NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN
ENV NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO=$NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO
RUN npm run build -w @mesa/web

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Server components read this at runtime — runner stage needs it too.
ARG NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO
ENV NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO=$NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/print-agent/VERSION ./apps/print-agent/VERSION
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
