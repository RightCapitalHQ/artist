FROM node:20.18.0@sha256:fffa89e023a3351904c04284029105d9e2ac7020886d683775a298569591e5bb

WORKDIR /app

COPY . /app/

RUN pnpm install && pnpm run build

CMD node dist/app.js
