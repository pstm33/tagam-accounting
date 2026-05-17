FROM node:20-alpine AS runtime

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/accounting-core/package.json packages/accounting-core/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/kmrs-bridge/package.json packages/kmrs-bridge/package.json

RUN npm ci

COPY apps apps
COPY db db
COPY packages packages

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=4010

EXPOSE 4010

CMD ["npm", "run", "dev:api"]
