from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes.auth import router as auth_router
from app.api.routes.budget import router as budget_router
from app.api.routes.onboarding import router as onboarding_router



app = FastAPI(title="Personal Finance & Budget Tracker API")

app.include_router(auth_router)
app.include_router(budget_router)
app.include_router(onboarding_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
