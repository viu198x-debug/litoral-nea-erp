FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci --ignore-scripts

COPY frontend ./frontend
COPY components ./components
COPY lib ./lib
COPY vendor ./vendor

ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE}
RUN npm --workspace frontend run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --chown=101:101 docker/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 --from=build /app/frontend/out /usr/share/nginx/html
EXPOSE 8080
