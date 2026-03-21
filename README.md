# 🏭 Factory Attendance System Pro v2.0
> Face Recognition · Shift Management · Overtime · Mobile View · 2000+ Employees

## 🚀 Quick Setup

### Step 1 — Start Redis + PostgreSQL (Docker)
```bash
docker run -d --name redis    -p 6379:6379 redis
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_DB=factory_attendance \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  postgres:15
```

### Step 2 — Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Edit .env with your settings
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
daphne -b 0.0.0.0 -p 8000 factory_attendance.asgi:application
```

### Step 3 — Frontend
```bash
cd frontend
npm install
npm start
# Open http://localhost:3000
```

---

## 📋 Usage Flow
1. **Shifts** → Add Morning/Afternoon/Night shifts
2. **Admin** (http://localhost:8000/admin) → Add Departments
3. **Employees** → Add employees → Click 📷 Face → Capture 5 angles
4. **Live Cameras** → Add camera → Walk past → System identifies
5. **Reports** → Filter by date → Export Excel/PDF
6. **Mobile View** → Employee enters ID → See own attendance

---

## 🔧 Key Settings (.env)
```env
DB_PASSWORD=postgres
FACE_THRESHOLD=0.38          # Lower=easier match (0.3-0.5)
CHECKIN_COOLDOWN=300         # Seconds between duplicate records
MAX_EMBEDDINGS_PER_PERSON=5  # Angles per person
TELEGRAM_BOT_TOKEN=          # Optional: alerts
TELEGRAM_CHAT_ID=            # Optional: alerts
```

---

## 📁 Project Structure
```
factory-attendance/
├── backend/
│   ├── attendance/
│   │   ├── models.py       Employee, Shift, OT, Attendance
│   │   ├── face_engine.py  InsightFace + FAISS (2000+ faces)
│   │   ├── consumers.py    WebSocket + late detection
│   │   ├── views.py        REST API + Excel/PDF export
│   │   └── notify.py       Telegram alerts
│   └── requirements.txt
└── frontend/src/pages/
    ├── Dashboard.js    Stats + Shift summary + Live feed
    ├── CameraPage.js   Multi-camera live stream
    ├── EmployeePage.js CRUD + 5-angle face register
    ├── ShiftPage.js    Shift management
    ├── OvertimePage.js OT approval + export
    ├── ReportsPage.js  Export Excel/PDF
    └── MobilePage.js   Employee self-service
```

## ⚡ Performance
| Operation | Speed |
|-----------|-------|
| FAISS search 2000 faces | < 1ms |
| Face detect + identify | ~60-100ms |
| 5 angles accuracy | ~95%+ |
