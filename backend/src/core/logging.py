"""Logging configuration for the application.

This module provides a centralized logging configuration with:
- Environment-based log levels
- Structured JSON logging
- Correlation ID support
- Performance timing utilities
"""

import logging
import json
import os
import time
import uuid
from typing import Any, Dict, Optional, List
from contextvars import ContextVar
from functools import wraps

# Initialize correlation ID context
correlation_id_ctx = ContextVar('correlation_id', default=None)

class StructuredJsonFormatter(logging.Formatter):
    """Custom formatter for structured JSON logs."""
    
    def __init__(self, use_indentation: bool = True):
        """Initialize formatter with indentation option."""
        super().__init__()
        self.use_indentation = use_indentation
    
    def format(self, record: logging.LogRecord) -> str:
        """Format the log record as a JSON string."""
        # Base log data
        log_data = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'component': record.name,
            'message': record.getMessage(),
        }
        
        # Add correlation ID if present
        correlation_id = correlation_id_ctx.get()
        if correlation_id:
            log_data['correlation_id'] = correlation_id
            
        # Add extra fields if present
        if hasattr(record, 'extra'):
            # Process each field in extra individually
            for key, value in record.extra.items():
                try:
                    # Test if this field can be serialized
                    json.dumps({key: value})
                    log_data[key] = value
                except (TypeError, ValueError) as e:
                    # If serialization fails, try to convert to string
                    try:
                        if hasattr(value, 'dict'):
                            # Handle Pydantic models
                            log_data[key] = value.dict()
                        elif hasattr(value, '__dict__'):
                            # Handle other objects with __dict__
                            log_data[key] = value.__dict__
                        else:
                            # Fall back to string representation
                            log_data[key] = str(value)
                    except Exception:
                        log_data[f"{key}_error"] = f"Failed to serialize: {str(e)}"
            
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
            
        # Use indentation in development for readability
        try:
            indent = 2 if self.use_indentation else None
            return json.dumps(log_data, indent=indent)
        except (TypeError, ValueError) as e:
            # Fallback if JSON serialization fails
            return json.dumps({
                'timestamp': self.formatTime(record),
                'level': 'ERROR',
                'component': record.name,
                'message': 'Failed to serialize log record',
                'error': str(e),
                'original_message': record.getMessage()
            }, indent=indent)

def setup_logging(env: str = None) -> None:
    """Configure application-wide logging.
    
    Args:
        env: Environment name ('development', 'staging', 'production')
             Defaults to 'development' if not specified or unknown
    """
    # Determine environment and log level
    env = env or os.getenv('APP_ENV', 'development')
    log_levels = {
        'production': logging.INFO,
        'staging': logging.DEBUG,
        'development': logging.INFO  # Raised from DEBUG to reduce noise
    }
    level = log_levels.get(env, logging.INFO)
    
    # Get components to filter (optional)
    component_filter = os.getenv('LOG_COMPONENTS', '').split(',')
    component_filter = [c.strip() for c in component_filter if c.strip()]
    
    # Create JSON formatter - use indentation in development
    formatter = StructuredJsonFormatter(use_indentation=(env == 'development'))
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Add console handler with JSON formatting
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Set third-party loggers to higher level to reduce noise
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('asyncio').setLevel(logging.WARNING)
    
    # If component filter is specified, adjust levels
    if component_filter:
        for logger_name in logging.root.manager.loggerDict:
            if logger_name not in component_filter:
                logging.getLogger(logger_name).setLevel(logging.WARNING)

def get_correlation_id() -> str:
    """Get the current correlation ID or generate a new one."""
    correlation_id = correlation_id_ctx.get()
    if correlation_id is None:
        correlation_id = str(uuid.uuid4())
        correlation_id_ctx.set(correlation_id)
    return correlation_id

def with_correlation_id(correlation_id: Optional[str] = None):
    """Decorator to set correlation ID for a function call."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            token = correlation_id_ctx.set(correlation_id or str(uuid.uuid4()))
            try:
                return await func(*args, **kwargs)
            finally:
                correlation_id_ctx.reset(token)
        return wrapper
    return decorator

def log_timing(logger: logging.Logger):
    """Decorator to log function execution time."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = (time.time() - start_time) * 1000  # Convert to ms
                logger.debug(
                    f"{func.__name__} completed",
                    extra={
                        'duration_ms': duration,
                        'correlation_id': get_correlation_id()
                    }
                )
                return result
            except Exception as e:
                duration = (time.time() - start_time) * 1000
                logger.error(
                    f"{func.__name__} failed",
                    extra={
                        'duration_ms': duration,
                        'error': str(e),
                        'correlation_id': get_correlation_id()
                    },
                    exc_info=True
                )
                raise
        return wrapper
    return decorator 