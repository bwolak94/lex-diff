FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/core/package.json ./packages/core/
RUN pnpm install --frozen-lockfile --filter @lexdiff/api...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/db ./packages/db
COPY packages/api ./packages/api
RUN pnpm --filter @lexdiff/core build && \
    pnpm --filter @lexdiff/db build && \
    pnpm --filter @lexdiff/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/api/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/server.js"]
