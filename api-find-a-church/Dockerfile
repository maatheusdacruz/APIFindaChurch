# Dockerfile de desenvolvimento (Fase 0). Para produção, troque por um
# multi-stage com `next build` + `next start`.
FROM node:20-alpine

# Prisma precisa do openssl em alpine.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "dev"]
