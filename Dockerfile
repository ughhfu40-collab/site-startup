FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run check && npm test && npm run build && npm prune --omit=dev && mkdir -p /app/.data && chown -R node:node /app/.data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/app/.data/studyhour.sqlite
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
