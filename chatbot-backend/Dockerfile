# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5001

CMD ["node", "src/server.js"]
