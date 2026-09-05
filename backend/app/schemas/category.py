from pydantic import BaseModel

from app.models.enums import BudgetBucket


class CategoryOut(BaseModel):
    id: int
    name: str
    bucket: BudgetBucket

    class Config:
        from_attributes = True
