FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/data
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev --no-audit --no-fund --prefix server
COPY server/ ./server/
COPY --from=client /app/client/dist ./client/dist
EXPOSE 3001
CMD ["node", "server/server.js"]
