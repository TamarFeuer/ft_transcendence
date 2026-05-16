#!/bin/sh
set -e

echo "Seeding base achievements (idempotent, no flush)..."
python manage.py shell <<'PY'
import json
from pathlib import Path
from game.models import Achievement

fixture_path = Path("fixtures/achievements.json")
items = json.loads(fixture_path.read_text())

created = 0
updated = 0

for item in items:
    if item.get("model") != "game.achievement":
        continue

    fields = item.get("fields", {})
    _, was_created = Achievement.objects.update_or_create(
        name=fields.get("name", ""),
        requirement_type=fields.get("requirement_type", ""),
        requirement_value=fields.get("requirement_value", 0),
        defaults={"description": fields.get("description", "")},
    )
    if was_created:
        created += 1
    else:
        updated += 1

print(f"Achievements seeded. created={created} updated={updated}")
PY

echo "Done."

