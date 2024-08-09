FROM node:20.16.0@sha256:1ae9ba874435551280e95c8a8e74adf8a48d72b564bf9dfe4718231f2144c88f

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
