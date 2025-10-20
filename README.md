# steering-interface

Prototype of a GUI for feature steering of LLMs, using [Goodfire's Ember API](https://www.goodfire.ai/blog/announcing-goodfire-ember) (no longer supported as of Oct 27, 2025).

The interface supports:
- Streaming message completions from LLaMA 3.1 8b
- Surfacing of activated features across a conversation
- Steering of individual features, along with comparisons between the unsteered and steered responses
- Semantic search across features in the model
- Auto-steer functionality that suggests features to steer based on the user query

**Paper**: Designing Intuitive Interfaces for Feature Steering of LLMs (IASDR 2025)

**Authors**: [Allison Huang](https://www.acyhuang.com), [Yihyun Lim](https://www.desfluence.com)

## Running the interface 
Running the frontend: 
from frontend/ `npm run dev`

Running the backend:
from root `uv run --project backend uvicorn backend.main:app --reload`