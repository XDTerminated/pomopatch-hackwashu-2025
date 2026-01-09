import asyncpg
from app.core.config import DATABASE_URL

pool = None


async def create_pool():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL)


async def close_pool():
    global pool
    if pool:
        await pool.close()


async def get_db():
    async with pool.acquire() as conn:
        yield conn
