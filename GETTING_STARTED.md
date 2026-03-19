# Getting Started with Melody Map

## What is Melody Map?

Melody Map is an AI-powered music discovery platform that transforms how you explore music. Instead of traditional genre-based browsing, Melody Map creates an interactive visual universe where songs exist as points in space, positioned by their sonic similarity.

## Key Features

🎵 **Interactive Music Map** - Explore music as a 2D constellation where similar songs cluster together

🤖 **AI Recommendations** - Get personalized suggestions based on your listening patterns

🎨 **Mood-Based Playlists** - Generate playlists by mood (dreamy, energetic, melancholic, etc.)

📊 **Analytics Dashboard** - Visualize your music taste with charts and statistics

🔍 **Smart Search** - Find songs and discover similar tracks instantly

## Quick Start (5 minutes)

### Prerequisites

- Python 3.9+
- Node.js 18+
- MongoDB 6.0+
- Spotify Developer Account (free)

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/melody-map.git
cd melody-map

# Run setup script (Linux/Mac)
chmod +x SETUP.sh
./SETUP.sh

# Or setup manually (Windows)
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Get Spotify API Credentials

1. Go to https://developer.spotify.com/dashboard
2. Click "Create an App"
3. Fill in app name and description
4. Copy your Client ID and Client Secret

### 3. Configure Environment

Edit `backend/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/melody_map
SECRET_KEY=your-random-secret-key-here
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
```

### 4. Start MongoDB

```bash
# Start MongoDB server
mongod --dbpath /path/to/your/data/directory
```

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 6. Open the App

Visit http://localhost:3000

## First Steps in the App

### 1. Create an Account
- Click "Sign Up"
- Enter username, email, and password
- You'll be automatically logged in

### 2. Explore the Music Map
- Navigate to the "Map" page
- Each dot represents a song
- Similar songs are positioned closer together
- Click on dots to see song details
- Zoom and pan to explore

### 3. Search for Music
- Go to "Discover" page
- Search for your favorite songs or artists
- Click on results to see similar tracks

### 4. Generate AI Playlists
- Visit "Playlists" page
- Select a mood (happy, dreamy, energetic, etc.)
- Click "Generate Playlist"
- AI creates a playlist matching that mood

### 5. View Your Analytics
- Check "Analytics" page
- See your genre distribution
- View cluster analysis
- Track your listening patterns

## Understanding the Music Map

### What are the dots?
Each dot is a song. The position is determined by its audio features:
- Energy
- Valence (happiness)
- Danceability
- Acousticness
- And more...

### What are the colors?
Colors represent clusters - groups of similar songs discovered by AI.

### How to navigate?
- **Click and drag** to pan
- **Scroll** to zoom
- **Click dots** to see song details

## How the AI Works

### Similarity Engine
Songs are analyzed based on 8 audio features. The AI uses:
- **Cosine Similarity** to measure how similar songs are
- **K-Means Clustering** to group similar songs
- **PCA** to reduce dimensions for visualization

### Recommendations
The system uses:
- **Content-Based Filtering** - Recommends songs similar to what you like
- **Collaborative Filtering** - Suggests songs liked by similar users
- **Hybrid Approach** - Combines both methods

### Mood Detection
Moods are mapped to audio feature ranges:
- **Happy**: High valence + high energy
- **Dreamy**: Medium valence + high acousticness
- **Energetic**: High energy + high danceability

## Troubleshooting

### Backend won't start
```bash
# Check if MongoDB is running
mongosh

# Check if port 5000 is available
lsof -i :5000  # Mac/Linux
netstat -ano | findstr :5000  # Windows

# Check environment variables
cat backend/.env
```

### Frontend won't start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check if port 3000 is available
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows
```

### Map is empty
```bash
# Generate the map
curl -X POST http://localhost:5000/api/map/generate \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or use the UI to trigger generation
```

### Can't connect to Spotify API
- Verify credentials in `.env`
- Check if credentials are correct in Spotify Dashboard
- Ensure no extra spaces in `.env` file

## Next Steps

### Add Your Music
1. Use Spotify API to import your library
2. Or manually add songs via the API
3. Generate the map to visualize

### Customize
- Adjust number of clusters in `similarity_engine.py`
- Add new moods in `recommendation_engine.py`
- Customize UI colors in `tailwind.config.js`

### Deploy
See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guide.

## Learning Resources

### Understanding the Code
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [ML_PIPELINE.md](ML_PIPELINE.md) - Machine learning details
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference

### Extending the Project
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - File organization
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Data models

## Common Use Cases

### For Music Lovers
- Discover new artists similar to your favorites
- Create mood-based playlists for different activities
- Visualize your music taste

### For Developers
- Learn full-stack development
- Understand machine learning in practice
- Build portfolio project

### For Data Scientists
- Experiment with clustering algorithms
- Try different dimensionality reduction techniques
- Implement recommendation systems

## Tips for Best Experience

1. **Add diverse music** - The map is more interesting with variety
2. **Interact with songs** - Like/play songs to improve recommendations
3. **Explore clusters** - Each cluster represents a unique music style
4. **Try different moods** - Experiment with playlist generation
5. **Check analytics** - Understand your listening patterns

## Getting Help

- Check documentation in `/docs` folder
- Review code comments
- Open an issue on GitHub
- Join our Discord community

## What's Next?

After getting comfortable with the basics:
1. Import your Spotify library
2. Invite friends to discover music together
3. Create custom mood mappings
4. Experiment with ML parameters
5. Deploy to production

Happy exploring! 🎵
