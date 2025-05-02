from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict, Tuple, Optional, Callable
import time
import logging
from collections import defaultdict
import asyncio

logger = logging.getLogger(__name__)

class RateLimiter(BaseHTTPMiddleware):
    """
    IP-based rate limiting middleware for FastAPI.
    
    Limits requests by IP address to a configurable number per hour.
    """
    
    def __init__(
        self, 
        app, 
        max_requests: int = 100,
        time_window: int = 3600,
        exclude_paths: Optional[list] = None
    ):
        """
        Initialize the rate limiter middleware.
        
        Args:
            app: The FastAPI application
            max_requests: Maximum number of requests per IP per time window
            time_window: Time window in seconds (default: 3600 = 1 hour)
            exclude_paths: List of path prefixes to exclude from rate limiting
        """
        super().__init__(app)
        self.max_requests = max_requests
        self.time_window = time_window
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/openapi.json"]
        
        # Track requests by IP
        self.request_counts: Dict[str, list] = defaultdict(list)
        
        # Start cleanup task to prevent memory leaks
        self.cleanup_task = None
        
    async def cleanup_old_requests(self):
        """Periodically clean up expired request timestamps."""
        while True:
            try:
                current_time = time.time()
                for ip, timestamps in list(self.request_counts.items()):
                    # Remove timestamps older than the time window
                    self.request_counts[ip] = [
                        ts for ts in timestamps 
                        if current_time - ts < self.time_window
                    ]
                    
                    # Remove IP from tracking if no recent requests
                    if not self.request_counts[ip]:
                        del self.request_counts[ip]
                        
            except Exception as e:
                logger.error(f"Error in rate limit cleanup: {str(e)}", exc_info=True)
                
            await asyncio.sleep(60)  # Run cleanup every minute
    
    def should_exclude(self, path: str) -> bool:
        """Check if the path should be excluded from rate limiting."""
        return any(path.startswith(exclude) for exclude in self.exclude_paths)
    
    def get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request headers."""
        # Try Vercel-specific headers first
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Use the first IP in the list (client IP)
            return forwarded_for.split(",")[0].strip()
            
        # Fall back to standard request client host
        return request.client.host if request.client else "unknown"
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process the request and apply rate limiting."""
        path = request.url.path
        
        # Skip rate limiting for excluded paths
        if self.should_exclude(path):
            return await call_next(request)
            
        # Get client IP
        client_ip = self.get_client_ip(request)
        current_time = time.time()
        
        # Remove expired timestamps
        self.request_counts[client_ip] = [
            ts for ts in self.request_counts[client_ip] 
            if current_time - ts < self.time_window
        ]
        
        # Check if rate limit exceeded
        if len(self.request_counts[client_ip]) >= self.max_requests:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            
            # Calculate time until reset
            oldest_timestamp = min(self.request_counts[client_ip]) if self.request_counts[client_ip] else current_time
            reset_time = int(oldest_timestamp + self.time_window - current_time)
            
            # Return rate limit exceeded response
            response = Response(
                content={"error": "Rate limit exceeded"},
                status_code=429,
                media_type="application/json"
            )
            
            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = str(self.max_requests)
            response.headers["X-RateLimit-Remaining"] = "0"
            response.headers["X-RateLimit-Reset"] = str(reset_time)
            response.headers["Retry-After"] = str(reset_time)
            
            return response
            
        # Track this request
        self.request_counts[client_ip].append(current_time)
        
        # Add rate limit headers to response
        response = await call_next(request)
        remaining = self.max_requests - len(self.request_counts[client_ip])
        
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        
        return response 