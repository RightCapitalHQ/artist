FROM node:20.18.1@sha256:f4755c9039bdeec5c736b2e0dd5b47700d6393b65688b9e9f807ec12f54a8690

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
