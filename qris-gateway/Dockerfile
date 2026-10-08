FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY LICENSE-UPSTREAM ./LICENSE-UPSTREAM
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=3010 DATA_DIR=/app/data
EXPOSE 3010
CMD ["node", "src/server.mjs"]
