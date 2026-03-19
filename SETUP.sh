#!/bin/bash

echo "🎵 Melody Map - Setup Script"
echo "=============================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.9 or higher."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB is not installed. Please install MongoDB 6.0 or higher."
    echo "   Visit: https://www.mongodb.com/docs/manual/installation/"
fi

echo "✅ Prerequisites check passed"
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
echo "✅ Backend dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ .env file created (please configure it)"
fi

cd ..

# Frontend setup
echo ""
echo "📦 Setting up frontend..."
cd frontend

# Install Node dependencies
npm install
echo "✅ Frontend dependencies installed"

cd ..

echo ""
echo "=============================="
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure backend/.env with your API keys"
echo "2. Start MongoDB: mongod --dbpath /path/to/data"
echo "3. Start backend: cd backend && source venv/bin/activate && python app.py"
echo "4. Start frontend: cd frontend && npm run dev"
echo ""
echo "Visit http://localhost:3000 to see the app"
echo "🎵 Happy coding!"
