from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import chat, features
from dotenv import load_dotenv
from .core.logging import setup_logging
from .core.config import get_settings
import logging

# Load environment variables
load_dotenv()

# Initialize logging
settings = get_settings()
setup_logging(env=settings.APP_ENV)

# Create FastAPI application
app = FastAPI(title="Steering Interface Backend")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    chat.router, 
    prefix="/api/v1",
    tags=["chat"]
)

# Add features router
app.include_router(
    features.router,
    prefix="/api/v1",
    tags=["features"]
)

# Add a test route to verify the server is working
@app.get("/")
async def root():
    return {"message": "Welcome to the Steering Interface API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 