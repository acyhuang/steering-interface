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

Create a `.env` file in the backend directory:

```
EMBER_API_KEY=your_api_key_here
```

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