# Pomo Patch

A productivity-focused plant growing game that combines Pomodoro timers with virtual gardening. Built as a monorepo with a React/Tauri frontend and FastAPI backend.

## Overview

Pomo Patch is an interactive game where users can grow virtual plants while managing their productivity through Pomodoro sessions. Players earn coins by completing work sessions, which they can use to purchase seeds, water plants, and expand their garden.

## Features

- **Virtual Garden**: Plant and grow three types of plants (Berries, Fungi, Roses) with multiple varieties and rarities
- **Pomodoro Timer**: Complete 25-minute work sessions and earn rewards
- **Dynamic Weather System**: Experience different weather conditions (Sunny, Rainy, Cloudy) that affect gameplay
- **Plant Growth**: Water seedlings, fertilize plants, and watch them grow through multiple stages
- **Player Economy**: Earn coins, buy seeds and tools, expand your plant inventory
- **Social Features**:
  - Leaderboard to compare progress with other players
  - Visit other players' gardens and view their plants
  - Search for players by username and tag
- **Audio System**: Interactive sound effects with mute controls
- **Real-time Synchronization**: Backend integration for persistent game state

## Tech Stack

### Frontend (`src/`)
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **Tailwind CSS 4** - Utility-first styling
- **Clerk** - Authentication and user management

### Desktop App (`src-tauri/`)
- **Tauri 2** - Desktop application framework
- **Rust** - Native desktop integration

### Backend (`src-python/`)
- **FastAPI** - Modern async web framework
- **PostgreSQL** - Database via asyncpg
- **Clerk** - JWT-based authentication
- **Uvicorn** - ASGI server

## Project Structure

```
hackwashu2025/
├── src/                  # React frontend (TypeScript)
│   ├── App.tsx           # Main game component
│   ├── AppWrapper.tsx    # Clerk authentication wrapper
│   ├── GameWrapper.tsx   # Game state management
│   ├── api.ts            # Backend API service
│   └── ...
├── src-python/           # FastAPI backend (Python)
│   ├── main.py           # API endpoints
│   └── .python-version   # Python version (3.13)
├── src-tauri/            # Tauri desktop app (Rust)
│   ├── src/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── public/               # Static assets
│   ├── Audio/            # Sound effects
│   └── Sprites/          # Game sprites
├── pyproject.toml        # Python dependencies
├── package.json          # Node.js dependencies
└── vite.config.ts        # Vite configuration
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- Python 3.13+
- Rust and Cargo (for Tauri)
- PostgreSQL database

### Frontend Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables (create `.env`):
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key_here
```

3. Start the development server:
```bash
pnpm dev
```

### Backend Installation

1. Install Python dependencies:
```bash
cd src-python
pip install -e ../  # or use uv: uv sync
```

2. Set up environment variables (create `.env` in root):
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
```

3. Start the backend server:
```bash
cd src-python
uvicorn main:app --reload
```

### Desktop App

Build the Tauri desktop application:
```bash
pnpm tauri build
```

## Game Mechanics

### Plants

- **3 Plant Families**: Berry, Fungi (Mushrooms), Rose
- **3 Rarity Tiers**: Common (79%), Rare (20%), Legendary (1%)
- **3 Growth Stages**: Seed → Sprout → Fully Grown

**Plant Species by Rarity:**
- **Fungi**: brown_mushroom (common), red_mushroom (rare), mario_mushroom (legendary)
- **Rose**: red_rose (common), pink_rose/white_rose (rare), withered_rose (legendary)
- **Berry**: blueberry (common), strawberry (rare), ancient_fruit (legendary)

### Economy

| Item | Cost |
|------|------|
| Seed Packet | 100 coins |
| Water | 25 coins |
| Fertilizer | 25 coins |
| Plant Limit Upgrade | 1000 coins (1.1x increase per upgrade) |

**Sell Values:**

| Rarity | Stage 1 | Stage 2 |
|--------|---------|---------|
| Common | 50 | 100 |
| Rare | 100 | 200 |
| Legendary | 250 | 500 |

### Pomodoro System

- **Work Session**: 25 minutes, earn 125 coins
- **Short Break**: 5 minutes, earn 25 coins
- **Long Break**: 15 minutes after every 4th Pomodoro, earn 75 coins

## API Endpoints

### User Endpoints

- `POST /users/` - Create new user
- `GET /users` - Get all users (leaderboard)
- `GET /users/{email}` - Get user by email
- `GET /users/by-username/{username}/{tag}` - Get user by username and tag
- `PATCH /users/{email}/username` - Update username
- `PATCH /users/{email}/money` - Change user money
- `POST /users/{email}/increase-plant-limit` - Upgrade plant capacity
- `POST /users/{email}/cycle-weather` - Change garden weather

### Plant Endpoints

- `POST /users/{email}/plants/` - Purchase and plant a new plant
- `GET /users/{email}/plants` - Get all user plants
- `PATCH /users/{email}/plants/{plant_id}/position` - Move plant position
- `PATCH /users/{email}/plants/{plant_id}/apply-water` - Water a plant
- `PATCH /users/{email}/plants/{plant_id}/apply-fertilizer` - Fertilize a plant
- `PATCH /users/{email}/plants/{plant_id}/grow` - Update plant growth
- `DELETE /users/{email}/plants/{plant_id}/sell` - Sell a plant

## Database Schema

**User Table:**
- `email` (primary key)
- `username` (unique)
- `money` (float)
- `plant_limit` (integer)
- `weather` (integer)

**Plant Table:**
- `plant_id` (primary key, auto-increment)
- `plant_type`, `plant_species`, `size`, `rarity`
- `x`, `y` (position)
- `stage`, `growth_time_remaining`, `fertilizer_remaining`
- `email` (foreign key to user)

## Scripts

- `pnpm dev` - Start frontend development server
- `pnpm build` - Build frontend for production
- `pnpm tauri dev` - Start Tauri development mode
- `pnpm tauri build` - Build desktop application

## License

This project was created for HackWashU 2025.
