FROM node:20.10.0@sha256:445acd9b2ef7e9de665424053bf95652e0b8995ef36500557d48faf29300170a

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
