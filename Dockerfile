# OS LESADOS — imagem de produção (Node 20, sem devDeps).
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.html ./
COPY server ./server
COPY context ./context

ENV NODE_ENV=production
# A plataforma injeta $PORT (Render/Railway/Fly). Default local: 8787.
ENV PORT=8787
EXPOSE 8787

CMD ["node", "server/nano-banana-proxy.mjs"]
