import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add ml-service root to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.inference import FraudInferenceEngine
from app.api.routes import router, set_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    artifacts_dir = os.path.join(os.path.dirname(__file__), "..", "artifacts", "v1")
    engine = FraudInferenceEngine(artifacts_dir)
    set_engine(engine)
    print("[FastAPI] ML Service startup complete. Listening for inference requests.")
    yield
    print("[FastAPI] ML Service shutting down.")

app = FastAPI(
    title="Bank Investigation ML Fraud Inference Service",
    description="Three-Model Ensemble Real-Time Fraud Scoring & Explainable AI Microservice",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
