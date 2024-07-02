FROM node:20.15.0@sha256:f172e4a7393cef2252c16f5f38d7abcf2cc0fd46c181c0ed5006cf3332e01173

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
