# Pomo Patch - Frontend

A productivity-focused plant growing game that combines Pomodoro timers with virtual gardening. This is the frontend application for Pomo Patch, built with React, TypeScript, and Tauri.

## Overview

Pomo Patch is an interactive game where users can grow virtual plants while managing their productivity through Pomodoro sessions. Players earn coins by completing work sessions, which they can use to purchase seeds, water plants, and expand their garden.

## Features

-   **Virtual Garden**: Plant and grow three types of plants (Berries, Fungi, Roses) with multiple varieties and rarities
-   **Pomodoro Timer**: Complete 25-minute work sessions and earn rewards
-   **Dynamic Weather System**: Experience different weather conditions (Sunny, Rainy, Cloudy) that affect gameplay
-   **Plant Growth**: Water seedlings, fertilize plants, and watch them grow through multiple stages
-   **Player Economy**: Earn coins, buy seeds and tools, expand your plant inventory
-   **Social Features**:
    -   Leaderboard to compare progress with other players
    -   Visit other players' gardens and view their plants
    -   Search for players by username and tag
-   **Audio System**: Interactive sound effects with mute controls
-   **Real-time Synchronization**: Backend integration for persistent game state

## Tech Stack

-   **React 19** - UI framework
-   **TypeScript** - Type-safe development
-   **Tauri 2** - Desktop application framework
-   **Vite** - Build tool and dev server
-   **Tailwind CSS 4** - Utility-first styling
-   **Clerk** - Authentication and user management

## Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   pnpm package manager
-   Rust and Cargo (for Tauri)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd hackwashu2025
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:
   Create a `.env` file with the following:

```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key_here
```

4. Start the development server:

```bash
pnpm dev
```

5. Build the desktop application:

```bash
pnpm tauri build
```

## Project Structure

```
src/
├── App.tsx              # Main game component
├── AppWrapper.tsx       # Clerk authentication wrapper
├── GameWrapper.tsx      # Game state management wrapper
├── LandingPage.tsx      # Initial landing page
├── SSOCallback.tsx      # OAuth callback handler
├── api.ts               # Backend API service
├── globals.css          # Global styles and animations
└── main.tsx            # Application entry point

public/
├── Audio/              # Sound effects
└── Sprites/            # Game sprites and UI elements
    ├── berry/          # Berry plant sprites
    ├── fungi/          # Mushroom plant sprites
    ├── roses/          # Rose plant sprites
    └── UI/             # User interface elements

src-tauri/              # Tauri desktop application code
```

## Game Mechanics

### Plants

-   **3 Plant Families**: Berry, Fungi (Mushrooms), Rose
-   **3 Rarity Tiers**: Rare (79%), Epic (20%), Legendary (1%)
-   **3 Growth Stages**: Sprout, Seedling, Mature
-   **Multiple Varieties**: Each family has different species based on rarity

### Economy

-   **Seed Cost**: 100 coins per seed packet
-   **Water Cost**: 25 coins to water a sprout
-   **Fertilizer Cost**: 25 coins per fertilizer application
-   **Selling Plants**: Earn coins based on plant stage and rarity
-   **Plant Limit Upgrades**: Expand inventory (costs increase with each upgrade)

### Pomodoro System

-   **Work Session**: 25 minutes, earn 125 coins (multiplied by plant bonuses)
-   **Short Break**: 5 minutes after each Pomodoro
-   **Long Break**: 15 minutes after every 4th Pomodoro
-   **Break Rewards**: Earn 25 coins per short break, 75 coins per long break

### Weather Effects

-   **Sunny**: Standard growth rates
-   **Rainy**: Enhanced growth with visual rain effects
-   **Cloudy**: Neutral conditions

## API Integration

The frontend communicates with a FastAPI backend for:

-   User authentication and profile management
-   Plant CRUD operations (create, update, delete)
-   Money transactions and plant limit upgrades
-   Weather cycling
-   Leaderboard data
-   Player search and garden viewing

Backend base URL: `http://localhost:8000`

## Scripts

-   `pnpm dev` - Start development server
-   `pnpm build` - Build for production
-   `pnpm preview` - Preview production build
-   `pnpm tauri` - Run Tauri CLI commands
-   `pnpm tauri dev` - Start Tauri development mode
-   `pnpm tauri build` - Build desktop application

## Authentication

Uses Clerk for user authentication with support for:

-   Email/password sign-in
-   OAuth providers (Google)
-   Session management
-   JWT token handling

## License

MIT

## Recommended IDE Setup

-   [VS Code](https://code.visualstudio.com/)
-   Extensions:
    -   Tauri
    -   rust-analyzer
    -   ESLint
    -   Prettier
    -   Tailwind CSS IntelliSense
