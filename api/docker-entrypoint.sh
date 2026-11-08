#!/bin/sh
# Generates a self-signed TLS certificate on first start so the private key is
# never baked into the image or committed to Git, then starts the given command.
set -e

CERT_DIR="${CERT_DIR:-/app/certs}"

if [ ! -f "$CERT_DIR/server.key" ] || [ ! -f "$CERT_DIR/server.cert" ]; then
    echo "Generating self-signed TLS certificate in $CERT_DIR"
    openssl req -nodes -new -x509 -days 365 -subj "/CN=localhost" \
        -keyout "$CERT_DIR/server.key" -out "$CERT_DIR/server.cert" > /dev/null 2>&1
fi

exec "$@"
