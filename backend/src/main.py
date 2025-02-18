from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import chat
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Steering Interface Backend")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    chat.router, 
    prefix="/api/v1",
    tags=["chat"]
)

# Add a test route to verify the server is working
@app.get("/")
async def root():
    return {"message": "Welcome to the Steering Interface API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"} 