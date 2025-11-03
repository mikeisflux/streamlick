FROM node:20-alpine

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    gcc \
    linux-headers

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3001 1935 40000-40100/udp

CMD ["npm", "start"]
