# 📦 PostgreSQL → Django → HTML (trial.html)

This guide shows how to fetch data from PostgreSQL using Django and display it in:

/frontend/src/trial.html

---

# 🧭 Architecture Overview

PostgreSQL → Django → API (JSON) → HTML (fetch)

---

# 📁 Project Context

You already have:
- PostgreSQL database
- Django backend (/backend)
- Frontend (/frontend)
- HTML file: /frontend/src/trial.html

---

# ⚙️ Step 1: Configure PostgreSQL in Django

File: backend/django_server/settings.py

Make sure your database config looks like this:

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'your_db',
        'USER': 'your_user',
        'PASSWORD': 'your_password',
        'HOST': 'db',
        'PORT': '5432',
    }
}

---

# 🧱 Step 2: Create API endpoint

File: backend/users/views.py

Add this function:

from django.http import JsonResponse
from django.contrib.auth.models import User

def get_users(request):
    users = list(User.objects.values('id', 'username', 'email'))
    return JsonResponse(users, safe=False)

---

# 🔗 Step 3: Add URL routes

File: backend/users/urls.py

from django.urls import path
from .views import get_users

urlpatterns = [
    path('users/', get_users),
]

---

File: backend/django_server/urls.py

from django.urls import path, include

urlpatterns = [
    path('api/', include('users.urls')),
]

---

# ▶️ Step 4: Run Django server

Run:

python manage.py runserver 0.0.0.0:8000

Test in browser:

http://localhost:8000/api/users/

You should see JSON data.

---

# 🌐 Step 5: Connect trial.html

File: frontend/src/trial.html

Replace content with:

<!DOCTYPE html>
<html>
<head>
  <title>Users</title>
</head>
<body>
  <h1>User List</h1>
  <ul id="users"></ul>

  <script>
    fetch('http://localhost:8000/api/users/')
      .then(res => res.json())
      .then(data => {
        const ul = document.getElementById('users');

        data.forEach(user => {
          const li = document.createElement('li');
          li.textContent = user.username + " (" + user.email + ")";
          ul.appendChild(li);
        });
      })
      .catch(err => console.error(err));
  </script>
</body>
</html>

---

# ⚠️ Step 6: Enable CORS

Install:

pip install django-cors-headers

Then edit backend/django_server/settings.py:

Add to INSTALLED_APPS:

'corsheaders',

Add to MIDDLEWARE (at the top):

'corsheaders.middleware.CorsMiddleware',

Add at the bottom:

CORS_ALLOW_ALL_ORIGINS = True

---

# 🧪 Step 7: Run frontend

cd frontend
npm run dev

Open your app and load trial.html.

---

# 🔄 Final Flow

1. HTML loads in browser
2. JavaScript sends request to Django API
3. Django fetches data from PostgreSQL
4. Django returns JSON
5. HTML displays the data

---

# ✅ Result

You now have:
- PostgreSQL connected to Django
- Django serving API data
- HTML displaying database content

---

# 🧠 Key Rule

HTML cannot directly access PostgreSQL.

Always use a backend (Django in your case).

---

# 🚀 Next Steps

- Use your own models (friends, game, tournament)
- Add authentication (token_auth.py)
- Build better UI (tables, search, etc.)
- Integrate into your main frontend routes