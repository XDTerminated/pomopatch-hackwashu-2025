from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr


class UsernameUpdate(BaseModel):
    new_username: str


class MoneyChange(BaseModel):
    amount: float


class PlantCreate(BaseModel):
    plant_type: str
    x: float
    y: float


class PlantPosition(BaseModel):
    x: float
    y: float


class GrowthTimeUpdate(BaseModel):
    time: int
