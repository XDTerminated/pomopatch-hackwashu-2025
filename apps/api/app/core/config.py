import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")

# Game constants
WATER_COST = 25
FERTILIZER_COST = 25
PLANT_COST = 100
INITIAL_USER_MONEY = 250.0
INITIAL_PLANT_LIMIT = 25
INITIAL_WEATHER = 0
PLANT_LIMIT_BASE_COST = 1000
PLANT_LIMIT_COST_MULTIPLIER = 1.1
PLANT_LIMIT_INCREASE = 25
STAGE_0_GROWTH_TIME = 30

PLANT_SPECIES = {
    "fungi": {
        0: ["brown_mushroom"],
        1: ["red_mushroom"],
        2: ["mario_mushroom"]
    },
    "rose": {
        0: ["red_rose"],
        1: ["pink_rose", "white_rose"],
        2: ["withered_rose"]
    },
    "berry": {
        0: ["blueberry"],
        1: ["strawberry"],
        2: ["ancient_fruit"]
    },
}

RARITY_PROBABILITIES = {
    0: 0.79,  # Common
    1: 0.20,  # Rare
    2: 0.01   # Legendary
}

STAGE_1_GROWTH_TIMES = {0: 60, 1: 120, 2: 360}

STAGE_1_SELL_VALUES = {0: 50, 1: 100, 2: 250}
STAGE_2_SELL_VALUES = {0: 100, 1: 200, 2: 500}

# CORS origins
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:1420",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:1420",
]
