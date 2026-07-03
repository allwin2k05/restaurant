#!/bin/bash

# Default values
export PORT=${PORT:-8080}
export SURREAL_USER=${SURREAL_USER:-root}
export SURREAL_PASS=${SURREAL_PASS:-root}
export SURREAL_STORE=${SURREAL_STORE:-mem}

# Substitute environment variables in Nginx template
rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
envsubst '$PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Check if an external SurrealDB URL is provided
if [ -n "$SURREAL_URL" ]; then
    echo "Using external SurrealDB instance: $SURREAL_URL"
    # Set the same URL for tracking API
    export TRACKING_DB_URL="$SURREAL_URL"
else
    # Fallback to 'mem' if SURREAL_STORE is set to unsupported pg/postgres engine
    if [[ "$SURREAL_STORE" == pg://* || "$SURREAL_STORE" == postgres://* || "$SURREAL_STORE" == postgresql://* ]]; then
         echo "Warning: PostgreSQL is not supported as a storage engine in SurrealDB v2. Falling back to in-memory store ('mem')."
         export SURREAL_STORE="mem"
    fi

    # Start local SurrealDB
    echo "Starting local SurrealDB on 127.0.0.1:8000 using store: $SURREAL_STORE"
    /usr/local/bin/surreal start --user "$SURREAL_USER" --pass "$SURREAL_PASS" "$SURREAL_STORE" --bind 127.0.0.1:8000 &
    
    export SURREAL_URL="ws://127.0.0.1:8000/rpc"
    export TRACKING_DB_URL="ws://127.0.0.1:8000/rpc"
fi

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
