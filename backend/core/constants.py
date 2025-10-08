"""
v2.0 constants for single conversation/variant MVP.

This module contains hardcoded IDs and configuration for the initial
prototype implementation. These constants allow us to build and test
the core steering functionality without implementing full storage.

TODO: Remove when storage layer is implemented in v2.1.
"""

# Hardcoded IDs for v2.0 
DEMO_CONVERSATION_ID = "demo-conversation"
DEMO_VARIANT_ID = "demo-variant"
DEMO_VARIANT_LABEL = "demo"

# Default model configuration
DEFAULT_BASE_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct"
# DEFAULT_BASE_MODEL = "meta-llama/Llama-3.3-70B-Instruct"
