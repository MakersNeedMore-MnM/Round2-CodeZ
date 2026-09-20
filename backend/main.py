import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from models.database import create_tables
from routers.auth_router import router as auth_router
from routers.student_router import router as student_router
from routers.teacher_router import router as teacher_router
from routers.parent_router import router as parent_router
from routers.admin_router import router as admin_router

app = FastAPI(title="TwinLearn API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(student_router, prefix="/api")
app.include_router(teacher_router, prefix="/api")
app.include_router(parent_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

# Mount static files
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
static_dir = os.path.join(frontend_dir, "static")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "TwinLearn"}


# Serve frontend for all non-API routes
@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    index_path = os.path.join(frontend_dir, "templates", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Frontend not found"}


@app.on_event("startup")
def startup():
    create_tables()
    print("[OK] TwinLearn API started - http://localhost:8000")
