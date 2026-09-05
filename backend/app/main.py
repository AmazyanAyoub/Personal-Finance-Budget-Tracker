from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes.auth import router as auth_router
from app.api.routes.budget import router as budget_router
from app.api.routes.onboarding import router as onboarding_router
from app.api.routes.income import router as income_router
from app.api.routes.categories import router as categories_router
from app.api.routes.expenses import router as expenses_router
from app.api.routes.budget_engine import router as budget_engine_router
from app.api.routes.debts import router as debts_router





app = FastAPI(title="Personal Finance & Budget Tracker API")

app.include_router(auth_router)
app.include_router(budget_router)
app.include_router(onboarding_router)
app.include_router(income_router)
app.include_router(categories_router)
app.include_router(expenses_router)
app.include_router(budget_engine_router)
app.include_router(debts_router)

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
