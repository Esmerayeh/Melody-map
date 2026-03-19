#!/bin/bash

echo "Melody Map — Setup"
echo "=================="
echo ""

# ── Prerequisite checks ────────────────────────────────────────────────────────

if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found. Install Python 3.9 or higher."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Install Node.js 18 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
NODE_VERSION=$(node -e 'process.stdout.write(process.versions.node)')
echo "Python $PYTHON_VERSION  |  Node $NODE_VERSION"
echo ""

# ── Backend ────────────────────────────────────────────────────────────────────

echo "Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  Virtual environment created"
fi

source venv/bin/activate

pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "  Dependencies installed"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "  .env created from .env.example — fill in your API keys before running"
    else
        cat > .env << 'EOF'
MONGODB_URI=mongodb://localhost:27017/melodymap
SECRET_KEY=change-me-to-a-random-string

SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5000/auth/spotify/callback

LASTFM_API_KEY=
LASTFM_API_SECRET=
LASTFM_REDIRECT_URI=http://127.0.0.1:5000/auth/lastfm/callback

UNSPLASH_ACCESS_KEY=
PINTEREST_ACCESS_TOKEN=

FRONTEND_URL=http://localhost:5173
FLASK_ENV=development
PORT=5000
EOF
        echo "  .env created — fill in your API keys before running"
    fi
else
    echo "  .env already exists — skipping"
fi

deactivate
cd ..

# ── Frontend ───────────────────────────────────────────────────────────────────

echo ""
echo "Setting up frontend..."
cd frontend

npm install --silent
echo "  Dependencies installed"

if [ ! -f ".env" ]; then
    echo "VITE_API_URL=http://127.0.0.1:5000" > .env
    echo "  frontend/.env created"
else
    echo "  frontend/.env already exists — skipping"
fi

cd ..

# ── Done ───────────────────────────────────────────────────────────────────────

echo ""
echo "=================="
echo "Setup complete."
echo ""
echo "Before running:"
echo "  1. Fill in backend/.env with your Spotify, Last.fm, and MongoDB credentials"
echo "  2. Register http://127.0.0.1:5000/auth/spotify/callback in your Spotify app settings"
echo ""
echo "To run locally (two terminals):"
echo ""
echo "  Terminal 1 — backend:"
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    python app.py"
echo ""
echo "  Terminal 2 — frontend:"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "Then open http://localhost:5173"
echo ""
echo "See GETTING_STARTED.md for full setup details."
echo "See DEPLOYMENT.md for Render + Vercel production deployment."
