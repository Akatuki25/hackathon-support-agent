#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec /usr/local/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
