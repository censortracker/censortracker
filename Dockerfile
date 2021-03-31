FROM node:14.16.0-alpine3.12

COPY . /code

RUN node --version && npm --version

WORKDIR /code

RUN npm install

