from fastapi import APIRouter
from .chat import router as chat_router
from .features import router as features_router

router = APIRouter()
router.include_router(chat_router, prefix="/chat", tags=["chat"])
router.include_router(features_router, prefix="/features", tags=["features"]) 