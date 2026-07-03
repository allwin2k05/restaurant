#!/bin/bash

# Default values
export PORT=${PORT:-8080}
export SURREAL_USER=${SURREAL_USER:-root}
export SURREAL_PASS=${SURREAL_PASS:-root}
export SURREAL_STORE=${SURREAL_STORE:-mem}

# Substitute environment variables in Nginx template
envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start SurrealDB
echo "Starting SurrealDB on 127.0.0.1:8000 using store: $SURREAL_STORE"
surreal start --user "$SURREAL_USER" --pass "$SURREAL_PASS" "$SURREAL_STORE" --bind 127.0.0.1:8000 &

# Set up environment for node services to connect to SurrealDB
export SURREAL_URL="ws://127.0.0.1:8000/rpc"
export TRACKING_DB_URL="ws://127.0.0.1:8000/rpc"

# Start Payments Server
echo "Starting Payments Server on 127.0.0.1:3133"
export PAYMENT_PORT=3133
export PAYMENT_HOST=127.0.0.1
cd /app/payments && npm start &

# Start Tracking API
echo "Starting Tracking API on 127.0.0.1:3138"
export TRACKING_PORT=3138
export TRACKING_HOST=127.0.0.1
cd /app/tracking-api && npm start &

# Start Nginx in foreground
echo "Starting Nginx on port $PORT"
nginx -g "daemon off;"
