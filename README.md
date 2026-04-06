# GitPulse

A self-hosted GitHub analytics dashboard that goes beyond what GitHub shows. Track traffic, stars, issues, PRs, contributors, and more — with historical data that GitHub deletes after 14 days.

## What It Tracks

**From GitHub API (stored daily, never lost):**
- Traffic — clones, views, unique visitors (GitHub only keeps 14 days, GitPulse keeps forever)
- Stars, forks, watchers over time
- Issues and pull requests (open, closed, merged)
- Contributors and commit activity
- Releases, languages, referrers, popular pages
- Repository size over time

**From External APIs (free, no auth needed):**
- Go module stats from deps.dev (dependents, versions)
- OpenSSF Security Scorecard
- Social mentions from Hacker News, Reddit, Stack Overflow

**Computed Metrics (no API, derived from stored data):**
- Project Health Score (0-100)
- Bus Factor
- Issue close rate and response time
- PR merge velocity
- Star growth rate and visitor-to-star conversion
- Fork/star ratio
- Release cadence

## Screenshots

_Coming soon_

## Setup

### Prerequisites
- Go 1.22+
- Node.js 20+
- MySQL
- Redis

### 1. Clone
```bash
git clone git@github.com:stackshy/GitPulse.git
cd GitPulse
```

### 2. Backend
```bash
cd backend

# Create your config
cp configs/.env.example configs/.env

# Edit configs/.env — set your GitHub token and repo URL
# GITHUB_TOKEN=ghp_your_token_here
# GITHUB_REPO=https://github.com/your-org/your-repo

# Run
go run main.go
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Configuration

All config is in `backend/configs/.env`:

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub personal access token with `repo` scope |
| `GITHUB_REPO` | Yes | Full GitHub repo URL (e.g. `https://github.com/owner/repo`) |
| `DB_HOST` | Yes | MySQL host |
| `DB_PORT` | Yes | MySQL port |
| `DB_USER` | Yes | MySQL user |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | MySQL database name |
| `REDIS_HOST` | Yes | Redis host |
| `REDIS_PORT` | Yes | Redis port |
| `GO_MODULE` | No | Go module path (auto-derived from repo) |
| `SEARCH_QUERY` | No | Search term for social mentions (auto-derived from repo name) |

### Docker
```bash
cp .env.example .env
# Edit .env with your values
docker compose up --build
```

## How It Works

1. Backend fetches data from GitHub API on startup and daily at midnight
2. Traffic data (clones, views, stars) is stored in MySQL — builds history beyond GitHub's 14-day limit
3. Other data (issues, PRs, contributors) is cached in Redis (25hr TTL)
4. All data is backed up to `backend/data/backup.json` after every sync
5. If the database is wiped, data auto-restores from the backup file on next startup
6. Frontend reads from the backend API — zero direct GitHub calls from the browser

## Tech Stack

- **Backend:** Go / GoFr framework / MySQL / Redis
- **Frontend:** Next.js / React / Recharts / Tailwind CSS
- **External APIs:** GitHub, deps.dev, OpenSSF Scorecard, HN Algolia, Reddit, StackOverflow

## License

MIT
