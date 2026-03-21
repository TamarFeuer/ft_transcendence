#!/bin/sh
set -e # zodat het script stopt als er een commando faalt, of als db niet opstart(exit(1)), container start niet verder

echo "Waiting for Postgres to be available..."

# Wait for Postgres to be available (up to ~60s)
python - <<'PY'
import os, time, sys, socket

DB_HOST = os.getenv('DB_HOST', 'db')
DB_PORT = int(os.getenv('DB_PORT', '5432'))

for _ in range(60):
    try:
        with socket.create_connection((DB_HOST, DB_PORT), timeout=1):
            sys.exit(0)
    except Exception:
        time.sleep(1)

sys.exit(1)
PY

python manage.py makemigrations tournament

echo "Running migrations...."
python manage.py migrate --noinput

echo "Migrations complete. Executing command: $@"
exec "$@"
