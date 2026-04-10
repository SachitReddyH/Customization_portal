from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.database import connect_db, close_db
from app.config import settings
from app.routers import auth, villas, categories, options, selections, quotes, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="Capstone Life Villa Customization Portal",
    description="Backend API for MSR Phase 3 Villa Customization Portal",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (floor plans, option images)
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Routers
app.include_router(auth.router)
app.include_router(villas.router)
app.include_router(categories.router)
app.include_router(options.router)
app.include_router(selections.router)
app.include_router(quotes.router)
app.include_router(admin.router)


@app.get("/", tags=["health"])
async def health():
    return {"status": "ok", "project": "Capstone Life Villa Customization Portal"}
