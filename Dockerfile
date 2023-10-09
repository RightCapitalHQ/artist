FROM node:18

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
