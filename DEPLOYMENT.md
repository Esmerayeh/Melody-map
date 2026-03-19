# Deployment Guide

## Prerequisites

- Node.js 18+
- Python 3.9+
- MongoDB 6.0+
- Spotify Developer Account

## Local Development Setup

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start MongoDB locally
mongod --dbpath /path/to/data

# Run backend
python app.py
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 3. Get Spotify API Credentials

1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Copy Client ID and Client Secret
4. Add to backend/.env

## Production Deployment

### Option 1: Heroku + Vercel + MongoDB Atlas

#### Backend (Heroku)

```bash
# Install Heroku CLI
heroku login

# Create app
heroku create melody-map-api

# Add MongoDB Atlas addon or use external
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set SECRET_KEY=your-secret-key
heroku config:set SPOTIFY_CLIENT_ID=your-client-id
heroku config:set SPOTIFY_CLIENT_SECRET=your-client-secret

# Deploy
git push heroku main
```

#### Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

cd frontend

# Deploy
vercel

# Set environment variable
vercel env add VITE_API_URL production
# Enter: https://melody-map-api.herokuapp.com
```

#### Database (MongoDB Atlas)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create cluster (free tier available)
3. Get connection string
4. Add to Heroku config: `heroku config:set MONGODB_URI=mongodb+srv://...`

### Option 2: Railway (Full Stack)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy backend
cd backend
railway up

# Deploy frontend
cd ../frontend
railway up

# Link services
railway link
```

### Option 3: Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/melody_map
      - SECRET_KEY=${SECRET_KEY}
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  mongo-data:
```

```bash
# Deploy
docker-compose up -d
```

## Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb://localhost:27017/melody_map
SECRET_KEY=your-secret-key-here
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
LASTFM_API_KEY=your-lastfm-api-key (optional)
FLASK_ENV=production
PORT=5000
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000
```

## Database Initialization

```bash
# Connect to MongoDB
mongosh

# Create database
use melody_map

# Create indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.songs.createIndex({ spotify_id: 1 }, { unique: true })
db.songs.createIndex({ title: "text", artist: "text" })
db.songs.createIndex({ cluster_id: 1 })
db.interactions.createIndex({ user_id: 1, timestamp: -1 })
```

## Performance Optimization

### Backend
- Enable Flask caching
- Use Redis for session storage
- Implement API rate limiting
- Add database connection pooling

### Frontend
- Enable code splitting
- Lazy load components
- Optimize D3.js rendering
- Use React.memo for expensive components
- Implement virtual scrolling for large lists

### Database
- Add appropriate indexes
- Use aggregation pipelines
- Implement data pagination
- Regular backup schedule

## Monitoring

### Recommended Tools
- Sentry for error tracking
- New Relic for performance monitoring
- MongoDB Atlas monitoring
- Heroku metrics

## Security Checklist

- [ ] Environment variables secured
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] JWT tokens with expiration
- [ ] Password hashing with bcrypt
- [ ] MongoDB authentication enabled
- [ ] API keys rotated regularly

## Scaling Strategy

### Horizontal Scaling
- Load balancer (Nginx/AWS ALB)
- Multiple backend instances
- MongoDB replica set
- Redis cluster for caching

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Implement caching layers
- Use CDN for static assets

## Backup Strategy

```bash
# MongoDB backup
mongodump --uri="mongodb://localhost:27017/melody_map" --out=/backup/$(date +%Y%m%d)

# Automated daily backups
0 2 * * * /usr/bin/mongodump --uri="$MONGODB_URI" --out=/backup/$(date +\%Y\%m\%d)
```

## Troubleshooting

### Backend won't start
- Check MongoDB connection
- Verify environment variables
- Check port availability
- Review logs: `heroku logs --tail`

### Frontend can't connect to API
- Verify VITE_API_URL
- Check CORS configuration
- Inspect network tab in browser
- Verify backend is running

### Map not rendering
- Check if songs have map_coordinates
- Run `/api/map/generate` endpoint
- Verify D3.js loaded correctly
- Check browser console for errors
