# Steering Interface Backend

Backend service for the Ember Steering Interface, providing chat completion and feature steering capabilities.

## Development Setup

1. Install Python 3.9 or higher
2. Install Poetry (recommended) or use pip with requirements.txt

### Using Poetry (Recommended)
```bash
# Install poetry
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Activate virtual environment
poetry shell
```

### Using pip
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file in the backend directory (see `.env.example` for all options):

```
# Required
EMBER_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# CORS Configuration (for production deployments)
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### CORS Configuration

The backend uses a flexible CORS configuration system:

1. **FRONTEND_URL** (recommended): Set this environment variable to your frontend URL for single-origin setups
2. **CORS_ORIGINS**: Alternative for multiple allowed origins (comma-separated)
3. **Environment fallbacks**: Automatic defaults based on APP_ENV (development uses localhost:5173)

## Running the Server

```bash
# Using poetry
poetry run uvicorn src.main:app --reload

# Using pip
uvicorn src.main:app --reload
```

## Development

- Format code: `black .`
- Sort imports: `isort .`
- Type checking: `mypy .`

## Vercel Deployment

The backend is configured to be deployed as a serverless function on Vercel. The deployment uses the following structure:

- `/api/index.py`: Vercel serverless function adapter for FastAPI
- `/api/requirements.txt`: Dependencies for the Vercel deployment
- `/vercel.json`: Configuration for Vercel deployment

### Deployment Configuration

The deployment implements several key security features:

1. **API Key Protection**: API keys are stored as Vercel environment variables and are never exposed to the frontend
2. **Rate Limiting**: IP-based rate limiting is implemented to prevent API abuse (100 requests per IP per hour)
3. **CORS Protection**: CORS is configured to only allow requests from approved frontend domains

### Environment Variables

The following environment variables must be set in the Vercel project settings:

- `EMBER_API_KEY`: The API key for the Ember API
- `OPENAI_API_KEY`: The API key for OpenAI API (used for clustering)
- `FRONTEND_URL`: The URL of your frontend deployment (e.g., `https://your-frontend.vercel.app`) - **recommended approach**
- `APP_ENV`: The environment to run in (`development`, `staging`, or `production`) - optional, auto-detected on Vercel

### Deployment Commands

```bash
# Deploy to Vercel
vercel

# Deploy to production
vercel --prod
```

### Security Considerations

The API key proxy pattern implemented in this project ensures that:

1. API keys are never exposed to the client-side code
2. All API requests are proxied through our backend
3. Rate limiting protects against abuse
4. CORS configuration prevents unauthorized access 