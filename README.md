# Capstone Life — Villa Customisation Portal

A web portal that allows villa customers to browse and select customisation upgrades, request quotes, and track their selections. Admins can manage customers, options, and quote requests.

---

## Project Structure

```
Customization/
├── backend/       # Python / FastAPI REST API
├── frontend/      # React / Vite web app
└── README.md
```

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.10 or higher | https://python.org |
| Node.js | 18 or higher | https://nodejs.org |
| npm | comes with Node.js | — |

A **MongoDB Atlas** database is already set up and running. The connection string is in `backend/.env`.

---

## Backend Setup

```bash
cd backend

# 1. Create a virtual environment
python -m venv venv

# 2. Activate it
#    Windows:
venv\Scripts\activate
#    Mac/Linux:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Make sure the .env file is present (see Environment Variables below)

# 5. Start the server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

---

## Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Set the API URL (see Environment Variables below)

# 3. Build for production
npm run build
# Output is in frontend/dist/ — serve this folder with any web server (Nginx, Apache, etc.)

# OR run the dev server locally
npm run dev
# Available at http://localhost:5173
```

---

## Environment Variables

### Backend — `backend/.env`
A sample file is at `backend/.env.example`. The actual `.env` with real credentials should be provided separately.

```
MONGODB_URI=<MongoDB Atlas connection string>
DATABASE_NAME=capstone_portal
SECRET_KEY=<long random string for JWT signing>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ALLOWED_ORIGINS=https://yourdomain.com
```

### Frontend — `frontend/.env` (create this file)
```
VITE_API_URL=https://your-backend-domain.com
```
This tells the frontend where the backend API is hosted.  
For local development this defaults to `http://localhost:8000` automatically.

---

## Deployment (Production)

### Backend
- Run with: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Or use a process manager like **PM2** or **systemd** to keep it running
- Make sure port 8000 is accessible (or proxy it through Nginx)

### Frontend
- Run `npm run build` inside the `frontend/` folder
- The `frontend/dist/` folder contains the built static files
- Serve `dist/` with **Nginx** or **Apache**
- Since it's a single-page app, configure the server to redirect all routes to `index.html`

### Nginx example config (serves both on the same domain)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (static files)
    root /path/to/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API (proxy)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Static Files

Product images and floor plans are served by the backend from the `backend/static/` folder. This folder must be present and accessible. It is included in the zip/repo.

---

## Admin Login

The admin account credentials are set in `backend/.env` under `ADMIN_EMAIL` and `ADMIN_PASSWORD`.  
To create the admin account in the database for the first time, run:

```bash
cd backend
python seed_db.py
```

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, React Router, Axios
- **Backend:** Python, FastAPI, Motor (async MongoDB driver)
- **Database:** MongoDB Atlas (cloud-hosted)
- **Auth:** JWT tokens
