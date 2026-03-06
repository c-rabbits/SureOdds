# ⚡ SureOdds

Real-time sports odds comparison and **arbitrage (sure bet) detection** platform.

## Features

- **Match List** — Live soccer matches from Premier League, La Liga, Bundesliga, Serie A, Ligue 1
- **Odds Comparison** — Side-by-side odds from Bet365, Pinnacle, Unibet, Stake, and more
- **Arbitrage Detection** — Automatic sure bet detection using `1/oddsA + 1/oddsB < 1`
- **Stake Calculator** — Calculates optimal stake distribution for guaranteed profit
- **Telegram Alerts** — Instant notifications when new sure bets are found

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, Tailwind CSS, TypeScript |
| Backend | Node.js, Express.js |
| Database | Supabase (PostgreSQL) |
| Odds Data | [The Odds API](https://the-odds-api.com) |
| Deployment | Vercel (frontend), Railway/Fly.io (backend) |
| Notifications | Telegram Bot API |

## Project Structure

```
SureOdds/
├── frontend/               # Next.js app
│   └── src/
│       ├── app/            # Pages (/, /arbitrage, /calculator)
│       ├── components/     # Reusable UI components
│       ├── lib/            # API client, utilities
│       └── types/          # TypeScript types
├── backend/                # Express API + collector
│   └── src/
│       ├── routes/         # /api/matches, /api/odds, /api/arbitrage
│       ├── services/       # Arbitrage engine, Telegram bot
│       ├── collector/      # Odds data fetcher (cron job)
│       └── config/         # Supabase client
│   └── supabase/
│       └── schema.sql      # Database schema
└── package.json            # Monorepo scripts
```

## Setup

### 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Run `backend/supabase/schema.sql` in the SQL editor

### 2. Odds API

Get a free API key from [the-odds-api.com](https://the-odds-api.com) (500 requests/month free).

### 3. Telegram Bot (optional)

1. Message [@BotFather](https://t.me/BotFather) on Telegram to create a bot
2. Get your `chat_id` by messaging [@userinfobot](https://t.me/userinfobot)

### 4. Environment Variables

**Backend** (`backend/.env`):
```env
PORT=4000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key
ODDS_API_KEY=your_odds_api_key
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
COLLECTOR_INTERVAL=60
FRONTEND_URL=http://localhost:3000
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 5. Install & Run

```bash
# Install all dependencies
npm run install:all

# Run frontend (port 3000)
npm run dev:frontend

# Run backend API (port 4000)
npm run dev:backend

# Run odds collector (runs every 60s)
npm run dev:collector
```

## Arbitrage Formula

```
arb = 1/oddsA + 1/oddsB          # 2-way
arb = 1/oddsH + 1/oddsD + 1/oddsA  # 3-way

if arb < 1:
  profit% = (1 - arb) * 100
  stake_A = (totalStake / arb) * (1 / oddsA)
  stake_B = (totalStake / arb) * (1 / oddsB)
```

## API Endpoints

```
GET  /api/matches              # List upcoming matches
GET  /api/matches/:id          # Single match
GET  /api/odds/:matchId        # Odds for a match
GET  /api/arbitrage            # Active arbitrage opportunities
POST /api/arbitrage/calculate  # Calculate stake distribution
```

## Disclaimer

This tool is for educational purposes only. Sports betting involves financial risk. Always bet responsibly and ensure betting is legal in your jurisdiction.
