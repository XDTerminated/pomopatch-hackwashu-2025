from fastapi import APIRouter, HTTPException, Depends
import asyncpg
import random

from app.db.database import get_db
from app.core.security import verify_clerk_token
from app.core.config import (
    WATER_COST,
    FERTILIZER_COST,
    PLANT_COST,
    STAGE_0_GROWTH_TIME,
    PLANT_SPECIES,
    RARITY_PROBABILITIES,
    STAGE_1_GROWTH_TIMES,
    STAGE_1_SELL_VALUES,
    STAGE_2_SELL_VALUES,
)
from app.models.schemas import PlantCreate, PlantPosition, GrowthTimeUpdate

router = APIRouter(tags=["plants"])


def generate_random_size():
    """Generate a random size between 0 and 1 using normal distribution."""
    size = random.gauss(0.5, 0.2)
    return max(0.0, min(1.0, size))


@router.post("/users/{email}/plants/", status_code=201)
async def create_plant(
    email: str,
    plant: PlantCreate,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's plants"
        )

    async with conn.transaction():
        user = await conn.fetchrow('SELECT money, plant_limit FROM "user" WHERE email = $1', email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        current_plant_count = await conn.fetchval(
            "SELECT COUNT(*) FROM plant WHERE email = $1",
            email
        )

        if current_plant_count >= user["plant_limit"]:
            raise HTTPException(
                status_code=400,
                detail=f"Plant limit reached. Current: {current_plant_count}/{user['plant_limit']}"
            )

        if user["money"] < PLANT_COST:
            raise HTTPException(
                status_code=400, detail=f"Insufficient money. Need {PLANT_COST} to create a plant"
            )

        if plant.plant_type not in PLANT_SPECIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid plant_type. Must be one of: {', '.join(PLANT_SPECIES.keys())}"
            )

        rand = random.random()
        if rand < RARITY_PROBABILITIES[0]:
            rarity = 0
        elif rand < RARITY_PROBABILITIES[0] + RARITY_PROBABILITIES[1]:
            rarity = 1
        else:
            rarity = 2

        species_list = PLANT_SPECIES[plant.plant_type][rarity]
        plant_species = random.choice(species_list)

        plant_size = generate_random_size()

        await conn.execute(
            'UPDATE "user" SET money = money - $1 WHERE email = $2',
            PLANT_COST,
            email
        )

        plant_id = await conn.fetchval(
            """INSERT INTO plant (plant_type, plant_species, size, rarity, x, y, stage, growth_time_remaining, email)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING plant_id""",
            plant.plant_type,
            plant_species,
            plant_size,
            rarity,
            plant.x,
            plant.y,
            0,
            None,
            email,
        )

        new_balance = await conn.fetchval('SELECT money FROM "user" WHERE email = $1', email)

    return {
        "message": "Plant created successfully",
        "plant_id": plant_id,
        "plant_type": plant.plant_type,
        "plant_species": plant_species,
        "size": plant_size,
        "rarity": rarity,
        "money_spent": PLANT_COST,
        "new_balance": new_balance
    }


@router.get("/users/{email}/plants")
async def get_user_plants(
    email: str,
    conn: asyncpg.Connection = Depends(get_db),
):
    plants = await conn.fetch(
        "SELECT * FROM plant WHERE email = $1",
        email,
    )

    return {"plants": [dict(p) for p in plants]}


@router.get("/users/{email}/plants/{plant_id}")
async def get_user_plant(
    email: str,
    plant_id: int,
    conn: asyncpg.Connection = Depends(get_db),
):
    plant = await conn.fetchrow(
        "SELECT * FROM plant WHERE plant_id = $1 AND email = $2",
        plant_id,
        email,
    )

    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    return dict(plant)


@router.patch("/users/{email}/plants/{plant_id}/position")
async def move_plant(
    email: str,
    plant_id: int,
    position: PlantPosition,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's plants"
        )

    result = await conn.execute(
        "UPDATE plant SET x = $1, y = $2 WHERE plant_id = $3 AND email = $4",
        position.x,
        position.y,
        plant_id,
        email,
    )

    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Plant not found")

    return {"message": "Plant moved successfully", "x": position.x, "y": position.y}


@router.patch("/users/{email}/plants/{plant_id}/apply-water")
async def apply_water(
    email: str,
    plant_id: int,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's plants"
        )

    async with conn.transaction():
        plant = await conn.fetchrow(
            "SELECT stage, growth_time_remaining FROM plant WHERE plant_id = $1 AND email = $2",
            plant_id,
            email,
        )

        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")

        stage = plant["stage"]
        growth_time_remaining = plant.get("growth_time_remaining")

        if stage != 0:
            raise HTTPException(
                status_code=400, detail="Can only water plants at stage 0"
            )

        if growth_time_remaining is not None:
            raise HTTPException(
                status_code=400, detail="Plant is already growing and doesn't need water"
            )

        user = await conn.fetchrow('SELECT money FROM "user" WHERE email = $1', email)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user["money"] < WATER_COST:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient money. Need {WATER_COST}, have {user['money']}"
            )

        await conn.execute(
            'UPDATE "user" SET money = money - $1 WHERE email = $2',
            WATER_COST,
            email
        )

        await conn.execute(
            "UPDATE plant SET growth_time_remaining = $1 WHERE plant_id = $2 AND email = $3",
            STAGE_0_GROWTH_TIME,
            plant_id,
            email,
        )

        new_money = await conn.fetchval('SELECT money FROM "user" WHERE email = $1', email)

        return {
            "message": "Water applied, plant started growing",
            "cost": WATER_COST,
            "new_money": new_money,
            "growth_time_remaining": STAGE_0_GROWTH_TIME
        }


@router.patch("/users/{email}/plants/{plant_id}/apply-fertilizer")
async def apply_fertilizer(
    email: str,
    plant_id: int,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's plants"
        )

    async with conn.transaction():
        plant = await conn.fetchrow(
            "SELECT stage, fertilizer_remaining, rarity, growth_time_remaining FROM plant WHERE plant_id = $1 AND email = $2",
            plant_id,
            email,
        )

        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")

        stage = plant["stage"]
        fertilizer_remaining = plant["fertilizer_remaining"]
        growth_time_remaining = plant.get("growth_time_remaining")

        if stage != 1:
            raise HTTPException(
                status_code=400, detail="Can only fertilize plants at stage 1"
            )

        if fertilizer_remaining is None or fertilizer_remaining == 0:
            raise HTTPException(
                status_code=400, detail="Plant doesn't need fertilizer"
            )

        if growth_time_remaining is not None:
            raise HTTPException(
                status_code=400, detail="Plant is already growing and doesn't need fertilizer"
            )

        user = await conn.fetchrow('SELECT money FROM "user" WHERE email = $1', email)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user["money"] < FERTILIZER_COST:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient money. Need {FERTILIZER_COST}, have {user['money']}"
            )

        await conn.execute(
            'UPDATE "user" SET money = money - $1 WHERE email = $2',
            FERTILIZER_COST,
            email
        )

        new_fertilizer_remaining = fertilizer_remaining - 1

        if new_fertilizer_remaining == 0:
            growth_time = STAGE_1_GROWTH_TIMES[plant["rarity"]]

            await conn.execute(
                "UPDATE plant SET fertilizer_remaining = NULL, growth_time_remaining = $1 WHERE plant_id = $2 AND email = $3",
                growth_time,
                plant_id,
                email
            )

            new_money = await conn.fetchval('SELECT money FROM "user" WHERE email = $1', email)

            return {
                "message": "Fertilizer applied, plant started growing",
                "cost": FERTILIZER_COST,
                "new_money": new_money,
                "fertilizer_remaining": None,
                "growth_time_remaining": growth_time
            }
        else:
            await conn.execute(
                "UPDATE plant SET fertilizer_remaining = $1 WHERE plant_id = $2 AND email = $3",
                new_fertilizer_remaining,
                plant_id,
                email
            )

            new_money = await conn.fetchval('SELECT money FROM "user" WHERE email = $1', email)

            return {
                "message": "Fertilizer applied",
                "cost": FERTILIZER_COST,
                "new_money": new_money,
                "fertilizer_remaining": new_fertilizer_remaining,
                "growth_time_remaining": None
            }


@router.patch("/users/{email}/plants/{plant_id}/grow")
async def grow_plant_by_time(
    email: str,
    plant_id: int,
    update: GrowthTimeUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's plants"
        )

    async with conn.transaction():
        plant = await conn.fetchrow(
            "SELECT growth_time_remaining, stage, rarity FROM plant WHERE plant_id = $1 AND email = $2",
            plant_id,
            email,
        )

        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")

        if plant["growth_time_remaining"] is None:
            raise HTTPException(
                status_code=400, detail="Plant is not currently growing"
            )

        new_time = max(0, plant["growth_time_remaining"] - update.time)

        if new_time == 0:
            current_stage = plant["stage"]

            if current_stage >= 2:
                raise HTTPException(
                    status_code=400, detail="Plant is already at maximum stage"
                )

            new_stage = current_stage + 1

            if new_stage == 1:
                rarity = plant.get("rarity", 0)
                fertilizer_map = {0: 1, 1: 2, 2: 5}
                fertilizer_init = fertilizer_map.get(rarity, 1)

                await conn.execute(
                    "UPDATE plant SET stage = $1, growth_time_remaining = NULL, fertilizer_remaining = $2 WHERE plant_id = $3 AND email = $4",
                    new_stage,
                    fertilizer_init,
                    plant_id,
                    email,
                )
            else:
                await conn.execute(
                    "UPDATE plant SET stage = $1, growth_time_remaining = NULL, fertilizer_remaining = NULL WHERE plant_id = $2 AND email = $3",
                    new_stage,
                    plant_id,
                    email,
                )

            return {
                "message": "Plant growth completed and advanced to next stage",
                "growth_time_remaining": None,
                "new_stage": new_stage,
                "stage_advanced": True,
            }
        else:
            await conn.execute(
                "UPDATE plant SET growth_time_remaining = $1 WHERE plant_id = $2 AND email = $3",
                new_time,
                plant_id,
                email,
            )

            return {
                "message": "Plant growth updated",
                "growth_time_remaining": new_time,
                "stage_advanced": False
            }


@router.delete("/users/{email}/plants/{plant_id}/sell")
async def sell_plant(
    email: str,
    plant_id: int,
    conn: asyncpg.Connection = Depends(get_db),
    auth_email: str = Depends(verify_clerk_token),
):
    if email != auth_email:
        raise HTTPException(
            status_code=403, detail="Cannot modify another user's plants"
        )

    async with conn.transaction():
        plant = await conn.fetchrow(
            "SELECT stage, rarity FROM plant WHERE plant_id = $1 AND email = $2",
            plant_id,
            email,
        )

        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")

        stage = plant["stage"]
        rarity = plant["rarity"]

        if stage == 0:
            money_earned = 0
        elif stage == 1:
            money_earned = STAGE_1_SELL_VALUES[rarity]
        else:
            money_earned = STAGE_2_SELL_VALUES[rarity]

        await conn.execute(
            "DELETE FROM plant WHERE plant_id = $1 AND email = $2",
            plant_id,
            email,
        )

        if money_earned > 0:
            await conn.execute(
                'UPDATE "user" SET money = money + $1 WHERE email = $2',
                money_earned,
                email,
            )

        new_balance = await conn.fetchval(
            'SELECT money FROM "user" WHERE email = $1', email
        )

    return {
        "message": "Plant sold successfully",
        "money_earned": money_earned,
        "new_balance": new_balance,
    }
