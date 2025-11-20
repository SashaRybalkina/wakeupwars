# WakeUpWars

Android-only mobile app with a Django backend and WebSockets (Daphne/Channels). This document explains how to fully build and run the project, which platforms it supports, and extra libraries needed.

- Platform: Android only
- Backend: Django 5, Django REST Framework, Channels (ASGI), Celery
- Realtime/Queues: Redis-compatible server (Memurai on Windows)
- Database: Amazon RDS (MariaDB)

---

## Prerequisites
- Windows 10/11
- Python 3.10+ and pip
- Node.js 18+ and npm
- Android Studio with SDK/Platform Tools (for emulator or USB debugging)
- Java 17 (JDK) for React Native Android builds
- Git
- MySQL client (for connecting to RDS)
- Memurai (Redis-compatible for Windows): https://www.memurai.com/get-memurai
- Optional: ngrok for public tunneling: https://ngrok.com/download

Backend Python dependencies are pinned in `requirements.txt` and include: Django, djangorestframework, channels, daphne, celery, channels_redis, mysqlclient, redis, etc. Frontend uses React Native/Expo (see `package.json`).

---

## Clone
```
git clone https://capstone.cs.utah.edu/wakeupwars/wakeupwars.git
cd wakeupwars
git checkout final-release
```

---

## AWS RDS (MariaDB) setup
1. In AWS Console: RDS → Databases → Create database
2. Standard create → MariaDB → Engine version: MariaDB 11.4.5
3. Template: Dev/Test
4. DB instance id: e.g. `wake-up-wars-db`
5. Credentials: master username/password (self-managed)
6. Instance class: Burstable `db.t3.micro`
7. Storage: General purpose SSD (gp3), 20 GiB, no autoscaling
8. High availability: No standby
9. Connectivity: IPv4, Default VPC, Public access: Yes, Security group: default
10. Proxy: No, Port: 3306, Auth: Password
11. Initial DB name: e.g. `wake_up_wars_db`

Allow your IP to access the DB:
- EC2 → Network & Security → Security groups → select Default SG → Edit inbound rules
- Add rule: MYSQL/Aurora (3306), Source: your IP

---

## Backend configuration
1. Install backend deps:
```
python -m pip install -r requirements.txt
```

2. Place Firebase private key at project root and name it `wakeupwars_private_key.json`.
   - `myserver/settings.py` loads it from project root via `FIREBASE_CRED_PATH`.
   - Private keys are expected at the project level.

3. Configure database in `myserver/settings.py` → `DATABASES` to match your new RDS instance:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'wake_up_wars_db',            # your DB name
        'USER': 'myUsername',                 # RDS username
        'PASSWORD': 'myPassword',             # RDS password
        'HOST': 'wake-up-wars-db.xxxxxxx.us-east-1.rds.amazonaws.com', # RDS endpoint
        'PORT': '3306',
    }
}
```

4. Create tables:
```
python manage.py makemigrations
python manage.py migrate
```

5. Seed required data (manual for now):
- Connect using the MySQL shell to your RDS, then insert the required bootstrap rows for the app to function (e.g., base categories, games, badges, etc.).
- There are currently no fixtures in the repo; if you need concrete SQL, contact maintainers to obtain the latest seed script and run it against your DB.

---

## Background jobs (Celery + Memurai)
1. Install Memurai (Windows Redis) from https://www.memurai.com/get-memurai
2. Verify it is running:
```
"C:\Program Files\memurai\memurai-cli.exe" -h 127.0.0.1 -p 6379 ping
# Expected output: PONG
```
3. Start Celery worker (from project root):
```
celery -A myserver worker --pool=solo -l info
```
Notes:
- `myserver/settings.py` defaults to `redis://127.0.0.1:6379/0` for broker/backend and Channels. Override with `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, or `REDIS_URL` if needed.

---

## Start the backend (ASGI/Daphne)
From the project root:
```
daphne -b 0.0.0.0 -p 8000 myserver.asgi:application
```
Ensure Windows firewall allows inbound traffic to port 8000 if testing on device.

---

## Frontend configuration
1. Install JS deps:
```
npm install
```
2. Set the API base URL in `src/app/api.ts`:
```ts
export const BASE_URL = 'http://<your-LAN-IP>:8000';
// Or use ngrok: e.g. https://xxxxx.ngrok-free.app
```
- If using ngrok: `ngrok http 8000` and use the forwarding URL.
- Some antivirus/Windows Defender realtime protection can interfere with ngrok; you may need to temporarily disable it.

---

## Run the Android app
You can use any Android phone or emulator.

- Emulator: Start an Android Virtual Device from Android Studio.
- Physical device: Enable USB debugging, connect via USB, set file transfer mode.

Then from the project root:
```
npx expo run:android
```
This will build and install the native Android app and run it connected to your backend.

---

## Testing (optional)
- Python: `pytest`
- JS/TS: `npm test`

---

## Troubleshooting
- Backend not reachable from device: Use your machine's LAN IP in `BASE_URL`, ensure device and PC are on same network, and allow port 8000 in firewall.
- Missing Firebase key: Ensure `wakeupwars_private_key.json` exists at project root and is valid.
- Redis connection errors: Confirm Memurai is running and reachable at `127.0.0.1:6379` (or update `REDIS_URL`).
- MySQL errors: Verify `DATABASES` credentials and that your IP is whitelisted in the RDS security group.

---

## Key libraries
Backend (`requirements.txt`):
- Django, djangorestframework, djangorestframework-simplejwt
- channels, daphne, channels_redis
- celery, django-celery-beat
- mysqlclient, PyMySQL, redis
- Pillow, requests, firebase-admin

Frontend: React Native + Expo (see `package.json`).

---

## Notes
- Android is the only supported platform.
