# Pomo Patch

A productivity-focused plant growing game that combines Pomodoro timers with virtual gardening. Built as a **Turborepo monorepo** with a React/Tauri frontend and FastAPI backend.

**HackWashU 2025 Winner**

## Overview

Pomo Patch is an interactive game where users can grow virtual plants while managing their productivity through Pomodoro sessions. Players earn coins by completing work sessions, which they can use to purchase seeds, water plants, and expand their garden.

## Features

- **Virtual Garden**: Plant and grow three types of plants (Berries, Fungi, Roses) with multiple varieties and rarities
- **Pomodoro Timer**: Complete 25-minute work sessions and earn rewards
- **Dynamic Weather System**: Experience different weather conditions (Sunny, Rainy, Cloudy)
- **Plant Growth**: Water seedlings, fertilize plants, and watch them grow through multiple stages
- **Player Economy**: Earn coins, buy seeds and tools, expand your plant inventory
- **Social Features**: Leaderboard, visit other gardens, search for players
- **Desktop App**: Native desktop application via Tauri

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4 |
| **Desktop** | Tauri 2, Rust |
| **Backend** | FastAPI, Python 3.13, asyncpg |
| **Auth** | Clerk |
| **Database** | PostgreSQL |
| **Monorepo** | Turborepo, pnpm |

## Project Structure

```
pomo-patch/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── app/            # App components
│   │   │   ├── features/       # Feature modules
│   │   │   └── services/       # API client
│   │   ├── public/             # Static assets
│   │   └── package.json
│   │
│   └── api/                    # FastAPI backend
│       ├── app/
│       │   ├── routers/        # API endpoints
│       │   ├── core/           # Config & security
│       │   ├── models/         # Pydantic schemas
│       │   └── db/             # Database
│       ├── Dockerfile
│       └── requirements.txt
│
├── src-tauri/                  # Tauri desktop app
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Python 3.13+
- Rust (for Tauri)
- PostgreSQL

### Installation

```bash
# Install dependencies
pnpm install

# Start both frontend and backend
pnpm dev

# Or start individually
pnpm dev:web    # Frontend at http://localhost:1420
pnpm dev:api    # Backend at http://localhost:8000
```

### Environment Variables

**Frontend** (`apps/web/.env`):
```
VITE_CLERK_PUBLISHABLE_KEY=your_key
VITE_API_URL=http://localhost:8000
```

**Backend** (`apps/api/.env`):
```
DATABASE_URL=postgresql://user:pass@localhost:5432/pomopatch
CLERK_SECRET_KEY=your_secret
CLERK_JWKS_URL=https://your-clerk.clerk.accounts.dev/.well-known/jwks.json
```

### Desktop App

```bash
pnpm tauri dev    # Development
pnpm tauri build  # Production build
```

## Deployment

### Frontend → Vercel
- Root Directory: `apps/web`
- Framework: Vite
- Auto-deploys on push

### Backend → Railway
- Root Directory: `apps/api`
- Uses Dockerfile
- Auto-deploys on push

## API Endpoints

### Users
- `POST /users/` - Create user
- `GET /users` - Leaderboard
- `GET /users/{email}` - Get user
- `PATCH /users/{email}/money` - Update balance
- `POST /users/{email}/increase-plant-limit` - Upgrade capacity

### Plants
- `POST /users/{email}/plants/` - Plant a seed
- `GET /users/{email}/plants` - Get plants
- `PATCH /users/{email}/plants/{id}/apply-water` - Water plant
- `PATCH /users/{email}/plants/{id}/apply-fertilizer` - Fertilize
- `DELETE /users/{email}/plants/{id}/sell` - Sell plant

## Game Mechanics

### Plants
- **3 Families**: Berry, Fungi, Rose
- **3 Rarities**: Common (79%), Rare (20%), Legendary (1%)
- **3 Stages**: Seed → Sprout → Fully Grown

### Economy
| Action | Cost/Reward |
|--------|-------------|
| Seed | 100 coins |
| Water | 25 coins |
| Fertilizer | 25 coins |
| Work Session (25 min) | +125 coins |
| Short Break | +25 coins |
| Long Break | +75 coins |

### Sell Values
| Rarity | Stage 1 | Stage 2 |
|--------|---------|---------|
| Common | 50 | 100 |
| Rare | 100 | 200 |
| Legendary | 250 | 500 |

## Scripts

```bash
pnpm dev          # Start all apps
pnpm dev:web      # Frontend only
pnpm dev:api      # Backend only
pnpm build        # Build all
pnpm tauri dev    # Desktop app dev
pnpm tauri build  # Desktop app build
```

## License

Created for HackWashU 2025.
