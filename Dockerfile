FROM node:20.18.1@sha256:d17aaa2a2fd82e09bd6a6da7cc4a79741340d2a3e39d172d1b30f295b1a850ff

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
