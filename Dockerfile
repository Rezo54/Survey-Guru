FROM node:24-bookworm-slim
WORKDIR /app
# Include the API and its workspace packages, not the web or mobile applications.
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages ./packages
# The root postinstall patches mobile code; it is intentionally not run for this API image.
RUN npm install --ignore-scripts --workspace @survey-guru/api --include-workspace-root
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
RUN npm run typecheck --workspace @survey-guru/api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
USER node
EXPOSE 8080
# tsx resolves TypeScript workspace exports and .js imports without requiring local env files.
CMD ["node", "node_modules/tsx/dist/cli.mjs", "apps/api/src/server.ts"]
