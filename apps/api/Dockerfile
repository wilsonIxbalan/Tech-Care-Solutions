FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.7 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @techcare/api --frozen-lockfile
COPY apps/api/ apps/api/
RUN pnpm --filter @techcare/api build

FROM build AS production-dependencies
RUN pnpm --filter @techcare/api deploy --prod --legacy /runtime

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /runtime ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
