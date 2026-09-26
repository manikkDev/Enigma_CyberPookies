# Arth Saathi

Full-stack AI assistant platform: a Next.js frontend, a primary Node/Express backend with AI-powered chat and analysis pipelines, and a secondary Express service for graph data and realtime features.

---

## Project Structure

```
├── client/            # Next.js frontend (port 3000)
├── chatbot-backend/   # Main backend — chat, auth, analysis, alerts, cases, SSE (port 5001)
└── server/            # Secondary backend — auth/users, Neo4j graph APIs, Socket.IO (port 5002)
```

---

## Prerequisites

- Node.js 18+
- npm (or bun)
- MongoDB (for `server`)
- Neo4j (for graph endpoints in `server`)
- Supabase project (for `chatbot-backend`)

---

## Environment Setup

### `chatbot-backend/.env`

```bash
PORT=5001
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
GROQ_KEY=your_groq_api_key
```

### `server/.env`

```bash
PORT=5002
DB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
```

### `client/.env` (optional — defaults to localhost)

```bash
MAIN_API_URL=http://localhost:5001
NEXT_PUBLIC_MAIN_API_URL=http://localhost:5001
NEXT_PUBLIC_GRAPH_API_URL=http://localhost:5002
NEXT_PUBLIC_ML_API_URL=http://localhost:8000
```

---

## Running Locally

```bash
# Terminal 1 — main backend
cd chatbot-backend && npm install && npm run dev

# Terminal 2 — secondary backend
cd server && npm install && npm run dev

# Terminal 3 — frontend
cd client && npm install && npm run dev
```

Then open http://localhost:3000.

---

## Deployment

- `client/` includes a `vercel.json` for Vercel deployment.
- `chatbot-backend/` includes a `Dockerfile`, `ecosystem.config.js` (PM2), and a GitHub Actions workflow (`.github/workflows/ci.yml`) that deploys to a VPS over SSH. Set `VPS_HOST`, `VPS_USER`, and `VPS_SSH_KEY` in your repository secrets to use it, then adjust `APP_PATH` to your server path.
