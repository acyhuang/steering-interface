from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import chat, features
from dotenv import load_dotenv
from .core.logging import setup_logging
from .core.config import get_settings
from .core.middleware import RateLimiter
import logging

# Load environment variables
load_dotenv()

# Initialize logging
settings = get_settings()
setup_logging(env=settings.APP_ENV)
logger = logging.getLogger("main")

# Log startup information
logger.info(f"Starting application in {settings.APP_ENV} environment")
if settings.is_vercel_deployment:
    logger.info("Running on Vercel deployment")

# Create FastAPI application
app = FastAPI(
    title="Steering Interface Backend",
    description="API for the Steering Interface",
    version="1.0.0"
)

# Add CORS middleware
logger.info(f"Configuring CORS with origins: {settings.get_cors_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
)

# Add rate limiting middleware
logger.info(f"Adding rate limiting middleware: {settings.get_rate_limit_settings}")
app.add_middleware(
    RateLimiter,
    max_requests=settings.RATE_LIMIT_MAX_REQUESTS,
    time_window=settings.RATE_LIMIT_WINDOW_SECONDS,
    exclude_paths=["/health", "/docs", "/openapi.json"]
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
    return {
        "message": "Welcome to the Steering Interface API",
        "environment": settings.APP_ENV,
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.APP_ENV,
        "is_vercel": settings.is_vercel_deployment
    } 