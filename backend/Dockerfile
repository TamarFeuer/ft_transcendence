FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends gettext \
	&& rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs
RUN chmod +x /app/seed.sh /app/seed_users.sh

# Expose port
EXPOSE 3000

CMD ["sh", "-c", "python manage.py migrate && /app/seed.sh && python manage.py compilemessages && daphne -b 0.0.0.0 -p 3000 django_server.asgi:application"]