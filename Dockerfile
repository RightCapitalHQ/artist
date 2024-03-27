FROM node:20.12.0@sha256:bf0ef0687ffbd6c7742e1919177826c8bf1756a68b51f003dcfe3a13c31c65fe

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
