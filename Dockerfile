FROM alpine:3.19

# Install Node.js, npm, nginx, gettext (for envsubst), bash, and curl
RUN apk add --no-cache nodejs npm nginx gettext bash curl

# Install SurrealDB
RUN curl -sSf https://install.surrealdb.com | sh

# Set up app directory
WORKDIR /app

# Copy package files and install dependencies for root, payments, and tracking-api
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY payments/package*.json ./payments/
RUN cd payments && npm install --omit=dev --legacy-peer-deps

COPY tracking-api/package*.json ./tracking-api/
RUN cd tracking-api && npm install --omit=dev --legacy-peer-deps

# Copy codebase
COPY payments ./payments
COPY tracking-api ./tracking-api

# Copy Nginx configuration template
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Expose default port
EXPOSE 8080

CMD ["./start.sh"]
