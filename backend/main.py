from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import goodfire
import logging

from backend.core.config import settings
from backend.routers.conversation import router as conversation_router
from backend.routers.variant import router as variant_router

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Steering Interface",
    description="API for steering-interface",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.on_event("startup")
async def startup_event():
    """Initialize shared resources on application startup."""
    logger.info("Initializing Ember SDK client...")
    
    if not settings.EMBER_API_KEY:
        logger.warning("❌ EMBER_API_KEY not set - Ember client will not function properly")
        return
    
    app.state.ember_client = goodfire.AsyncClient(
        api_key=settings.EMBER_API_KEY
    )
    logger.info("Ember SDK client initialized")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conversation_router)
app.include_router(variant_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)