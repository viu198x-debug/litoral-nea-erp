FROM node:22-alpine AS build
WORKDIR /app
ENV CHECKPOINT_DISABLE=1
ENV PRISMA_HIDE_UPDATE_MESSAGE=1

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci

COPY backend ./backend
COPY database ./database
# Seed local parametrizado: requiere el catálogo de 45 módulos.
COPY frontend/lib ./frontend/lib
RUN ./node_modules/.bin/prisma generate --schema database/prisma/schema.prisma
RUN npm --workspace backend run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV CHECKPOINT_DISABLE=1
ENV PRISMA_HIDE_UPDATE_MESSAGE=1

COPY --from=build /app/node_modules ./node_modules
# npm workspaces resuelve Multer (y otras dependencias no elevadas) aquí.
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/database ./database
COPY --from=build /app/frontend/lib ./frontend/lib
COPY docker/entrypoint-backend.sh /usr/local/bin/entrypoint-backend
RUN mkdir -p /app/storage/documents \
    && chown -R node:node /app/storage \
    && chmod 0555 /usr/local/bin/entrypoint-backend

USER node

EXPOSE 4000
ENTRYPOINT ["entrypoint-backend"]
