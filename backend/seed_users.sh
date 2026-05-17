#!/bin/sh
set -e

echo "Applying migrations before user fixture load..."
python manage.py makemigrations --noinput || true
python manage.py migrate --run-syncdb

echo "Loading users fixture without flush..."
python manage.py loaddata fixtures/users.json

echo "Users fixture loaded."
