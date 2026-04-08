#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Loading fixtures..."
python manage.py loaddata fixtures/users.json

echo "Done."
