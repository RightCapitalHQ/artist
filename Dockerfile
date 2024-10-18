FROM node:20.18.0@sha256:196a5fcd13db4362fb9c0ec5391db36ec954c65d6b0d0e5d37f59c7dc9920690

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
