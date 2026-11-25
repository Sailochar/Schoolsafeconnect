# Production Multi-Stage Dockerfile for School Safe Connect Backend
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine

WORKDIR /usr/src/app

# Install dumb-init for proper signal forwarding
RUN apk add --no-cache dumb-init

# Create non-privileged service user
RUN addgroup -g 1001 -S sscgroup && \
    adduser -u 1001 -S sscuser -G sscgroup

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

USER sscuser

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]
