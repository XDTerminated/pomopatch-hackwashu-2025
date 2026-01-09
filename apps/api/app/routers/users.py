from fastapi import APIRouter, HTTPException, Depends
import asyncpg

from app.db.database import get_db
from app.core.security import verify_clerk_token
from app.core.config import (
    INITIAL_USER_MONEY,
    INITIAL_PLANT_LIMIT,
    INITIAL_WEATHER,
    PLANT_LIMIT_BASE_COST,
    PLANT_LIMIT_COST_MULTIPLIER,
    PLANT_LIMIT_INCREASE,
)
from app.models.schemas import UserCreate, UsernameUpdate, MoneyChange

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/", status_code=201)
async def create_user(
    user: UserCreate,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if user.email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot create user with different email"
        )

    existing = await conn.fetchval('SELECT 1 FROM "user" WHERE email = $1', user.email)
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    base_username = user.email.split('@')[0]

    for i in range(10000):
        candidate = f"{base_username}#{i:04d}"
        try:
            await conn.execute(
                'INSERT INTO "user" (username, email, money, plant_limit, weather) VALUES ($1, $2, $3, $4, $5)',
                candidate,
                user.email,
                INITIAL_USER_MONEY,
                INITIAL_PLANT_LIMIT,
                INITIAL_WEATHER,
            )

            return {
                "message": "User created successfully",
                "email": user.email,
                "username": candidate,
                "money": INITIAL_USER_MONEY,
                "plant_limit": INITIAL_PLANT_LIMIT,
                "weather": INITIAL_WEATHER,
            }
        except asyncpg.UniqueViolationError:
            continue

    raise HTTPException(status_code=500, detail="Unable to generate a unique username")


@router.get("")
async def get_users(
    conn: asyncpg.Connection = Depends(get_db),
):
    users = await conn.fetch('SELECT * FROM "user" ORDER BY money DESC')
    return {"users": [dict(u) for u in users]}


@router.get("/{email}")
async def get_user(
    email: str,
    conn: asyncpg.Connection = Depends(get_db),
):
    user = await conn.fetchrow('SELECT * FROM "user" WHERE email = $1', email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


@router.get("/by-username/{username}/{tag}")
async def get_user_from_username(
    username: str,
    tag: str,
    conn: asyncpg.Connection = Depends(get_db),
):
    full_username = f"{username}#{tag}"
    user = await conn.fetchrow('SELECT * FROM "user" WHERE username = $1', full_username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


@router.patch("/{email}/username")
async def update_username(
    email: str,
    update: UsernameUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot update another user's username"
        )

    result = await conn.execute(
        'UPDATE "user" SET username = $1 WHERE email = $2', update.new_username, email
    )

    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "message": "Username updated successfully",
        "new_username": update.new_username,
    }


@router.delete("/{email}")
async def delete_user(
    email: str,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot delete another user's account"
        )

    async with conn.transaction():
        await conn.execute("DELETE FROM plant WHERE email = $1", email)
        result = await conn.execute('DELETE FROM "user" WHERE email = $1', email)

        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deleted successfully"}


@router.patch("/{email}/money")
async def change_money(
    email: str,
    update: MoneyChange,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's money"
        )

    result = await conn.execute(
        'UPDATE "user" SET money = money + $1 WHERE email = $2', update.amount, email
    )

    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="User not found")

    new_balance = await conn.fetchval(
        'SELECT money FROM "user" WHERE email = $1', email
    )
    return {"message": "Money updated successfully", "new_balance": new_balance}


@router.post("/{email}/increase-plant-limit")
async def increase_plant_limit(
    email: str,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's plant limit"
        )

    async with conn.transaction():
        user = await conn.fetchrow('SELECT money, plant_limit FROM "user" WHERE email = $1', email)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        num_upgrades = (user["plant_limit"] - INITIAL_PLANT_LIMIT) // PLANT_LIMIT_INCREASE
        cost = round(int(PLANT_LIMIT_BASE_COST * (PLANT_LIMIT_COST_MULTIPLIER ** num_upgrades)), -2)

        if user["money"] < cost:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient money to increase plant limit. Need {cost}, have {user['money']}"
            )

        await conn.execute(
            'UPDATE "user" SET money = money - $1, plant_limit = plant_limit + $2 WHERE email = $3',
            cost,
            PLANT_LIMIT_INCREASE,
            email
        )

        new_money = await conn.fetchval('SELECT money FROM "user" WHERE email = $1', email)
        new_plant_limit = await conn.fetchval('SELECT plant_limit FROM "user" WHERE email = $1', email)

        next_cost = round(int(PLANT_LIMIT_BASE_COST * (PLANT_LIMIT_COST_MULTIPLIER ** (num_upgrades + 1))), -2)

    return {
        "message": "Plant limit increased successfully",
        "cost_paid": cost,
        "new_money": new_money,
        "new_plant_limit": new_plant_limit,
        "next_upgrade_cost": next_cost
    }


@router.post("/{email}/cycle-weather")
async def cycle_weather(
    email: str,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's weather"
        )

    user = await conn.fetchrow('SELECT weather FROM "user" WHERE email = $1', email)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_weather = user["weather"]
    new_weather = (current_weather + 1) % 3

    await conn.execute(
        'UPDATE "user" SET weather = $1 WHERE email = $2',
        new_weather,
        email
    )

    return {
        "message": "Weather cycled successfully",
        "previous_weather": current_weather,
        "new_weather": new_weather
    }
