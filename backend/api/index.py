import sys
import os
import logging

# Add the src directory to the Python path to allow imports from backend/src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging for serverless environment
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
)
logger = logging.getLogger("api")

# Set environment variables for Vercel
os.environ["IS_VERCEL"] = "true"
os.environ["VERCEL_ENV"] = os.environ.get("VERCEL_ENV", "development")
os.environ["VERCEL_REGION"] = os.environ.get("VERCEL_REGION", "")

# Import the FastAPI app
try:
    from src.main import app
    logger.info("Successfully imported FastAPI app")
except Exception as e:
    logger.error(f"Error importing FastAPI app: {str(e)}", exc_info=True)
    from fastapi import FastAPI
    app = FastAPI(title="Error App")
    
    @app.get("/")
    async def error_route():
        return {"error": "Failed to load main application"}

# Standard handler for Vercel
from mangum import Mangum
handler = Mangum(app) 