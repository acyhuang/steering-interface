from fastapi import FastAPI
import sys
import os
from importlib import util
import json
import logging
from urllib.parse import parse_qs
import base64

# Add the src directory to the Python path to allow imports from backend/src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging for serverless environment
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
)
logger = logging.getLogger("api")

# Import the FastAPI app from src/main.py
try:
    from src.main import app as fastapi_app
    logger.info("Successfully imported FastAPI app")
except Exception as e:
    logger.error(f"Error importing FastAPI app: {str(e)}", exc_info=True)
    fastapi_app = FastAPI(title="Error App")
    
    @fastapi_app.get("/")
    async def error_route():
        return {"error": "Failed to load main application"}

async def handle_request(request):
    """
    Handle a request using the FastAPI app.
    This is a simple implementation of the ASGI interface.
    """
    from starlette.types import Receive, Scope, Send
    
    # Parse request information
    method = request.get("method", "GET")
    path = request.get("path", "/")
    query_string = ""
    
    # Handle query params
    query_params = request.get("query", {})
    if query_params:
        query_string = "&".join([f"{k}={v}" for k, v in query_params.items()])
    
    headers = request.get("headers", {})
    body_raw = request.get("body", "")
    
    # Convert headers to ASGI format
    asgi_headers = []
    for key, value in headers.items():
        asgi_headers.append([key.lower().encode(), value.encode()])
    
    # Create ASGI scope
    scope = {
        "type": "http",
        "asgi": {
            "version": "3.0",
            "spec_version": "2.0"
        },
        "http_version": "1.1",
        "method": method,
        "scheme": "https",
        "path": path,
        "query_string": query_string.encode(),
        "headers": asgi_headers,
        "client": ("127.0.0.1", 0),  # Default client info
        "server": ("vercel", 0),     # Default server info
    }
    
    # Decode body if it exists and is base64 encoded
    body = b""
    if body_raw:
        if request.get("isBase64Encoded", False):
            body = base64.b64decode(body_raw)
        else:
            body = body_raw.encode()
    
    # Create ASGI receive function
    async def receive():
        return {
            "type": "http.request",
            "body": body,
            "more_body": False,
        }
    
    # Initialize response data
    response_data = {
        "statusCode": 200,
        "headers": {},
        "body": "",
        "isBase64Encoded": False,
    }
    
    # Create ASGI send function
    async def send(message):
        if message["type"] == "http.response.start":
            response_data["statusCode"] = message.get("status", 200)
            
            # Process headers
            for key, value in message.get("headers", []):
                key_str = key.decode()
                value_str = value.decode()
                response_data["headers"][key_str] = value_str
                
        elif message["type"] == "http.response.body":
            response_data["body"] += message.get("body", b"").decode()
    
    # Call the FastAPI app
    try:
        await fastapi_app(scope, receive, send)
        
        # Convert response body to JSON if content-type is application/json
        content_type = response_data["headers"].get("content-type", "")
        if "application/json" in content_type and response_data["body"]:
            try:
                # Parse as JSON to ensure it's valid
                json.loads(response_data["body"])
            except:
                # If parsing fails, leave as is
                pass
                
        return response_data
    except Exception as e:
        logger.error(f"Error handling request: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }

# The handler function for Vercel serverless functions
async def handler(request):
    """
    Entrypoint for Vercel serverless function.
    """
    try:
        logger.info(f"Received request: {request.get('method', 'UNKNOWN')} {request.get('path', '/')}")
        return await handle_request(request)
    except Exception as e:
        logger.error(f"Unhandled error in handler: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json"},
            "body": json.dumps({"error": "Internal server error"}),
        }

# Function entrypoint that Vercel uses
def entrypoint(event, context):
    """
    Vercel entrypoint for Python function.
    """
    import asyncio
    
    # Set environment variables for Vercel
    os.environ["IS_VERCEL"] = "true"
    os.environ["VERCEL_ENV"] = os.environ.get("VERCEL_ENV", "development")
    os.environ["VERCEL_REGION"] = os.environ.get("VERCEL_REGION", "")
    
    return asyncio.run(handler(event)) 