FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ARG PNPM_VERSION=10.4.1

COPY . .

# Install an exact pnpm version directly. This avoids Corepack's release-signature
# lookup failures while retaining strict lockfile validation.
RUN npm install --global "pnpm@${PNPM_VERSION}" \
  && test "$(pnpm --version)" = "${PNPM_VERSION}" \
  && pnpm install --frozen-lockfile \
  && pnpm run build \
  && pnpm store prune

EXPOSE 3000

CMD ["node", "dist/index.js"]

