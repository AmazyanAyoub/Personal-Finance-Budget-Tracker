from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.categories import router as categories_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.debts import router as debts_router
from app.api.routes.goals import router as goals_router
from app.api.routes.investments import router as investments_router
from app.api.routes.money import router as money_router
from app.api.routes.onboarding import router as onboarding_router
from app.api.routes.settings import router as settings_router
from app.core.config import settings


app = FastAPI(title="Nisba API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(onboarding_router)
app.include_router(settings_router)
app.include_router(categories_router)
app.include_router(money_router)
app.include_router(goals_router)
app.include_router(debts_router)
app.include_router(investments_router)
app.include_router(dashboard_router)


@app.get("/health")
def health():
    return {"status": "ok"}