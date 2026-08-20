FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

COPY . .

RUN npm install -g corepack@latest \
  && corepack pnpm install --frozen-lockfile \
  && corepack pnpm run build \
  && corepack pnpm store prune

EXPOSE 3000

CMD ["node", "dist/index.js"]
