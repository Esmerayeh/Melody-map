# Melody Map - Project Structure

```
melody-map/
│
├── README.md                      # Project overview and quick start
├── ARCHITECTURE.md                # System architecture documentation
├── DATABASE_SCHEMA.md             # MongoDB schema and queries
├── DEPLOYMENT.md                  # Deployment guide
├── ML_PIPELINE.md                 # ML algorithms documentation
├── PROJECT_STRUCTURE.md           # This file
│
├── backend/                       # Python Flask backend
│   ├── app.py                     # Main Flask application
│   ├── config.py                  # Configuration management
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # Environment variables template
│   │
│   ├── models/                    # Data models
│   │   └── schemas.py             # MongoDB schema definitions
│   │
│   ├── ml/                        # Machine learning modules
│   │   ├── similarity_engine.py   # Similarity & clustering algorithms
│   │   └── recommendation_engine.py # Recommendation algorithms
│   │
│   ├── services/                  # External services
│   │   └── spotify_service.py     # Spotify API integration
│   │
│   └── data/                      # Sample data
│       └── sample_songs.json      # Example song data
│
├── frontend/                      # React frontend
│   ├── package.json               # Node dependencies
│   ├── vite.config.js             # Vite configuration
│   ├── tailwind.config.js         # Tailwind CSS config
│   ├── postcss.config.js          # PostCSS config
│   ├── index.html                 # HTML entry point
│   │
│   └── src/                       # Source code
│       ├── main.jsx               # React entry point
│       ├── App.jsx                # Main app component
│       ├── index.css              # Global styles
│       │
│       ├── components/            # Reusable components
│       │   └── Navbar.jsx         # Navigation bar
│       │
│       ├── pages/                 # Page components
│       │   ├── Login.jsx          # Authentication page
│       │   ├── MusicMap.jsx       # Interactive map (D3.js)
│       │   ├── Discover.jsx       # Search & discovery
│       │   ├── Playlists.jsx      # Playlist generation
│       │   └── Analytics.jsx      # User analytics dashboard
│       │
│       └── utils/                 # Utility functions
│           └── api.js             # API client (optional)
│
└── docs/                          # Additional documentation
    ├── API.md                     # API endpoint documentation
    ├── UI_DESIGN.md               # UI/UX design guidelines
    └── CONTRIBUTING.md            # Contribution guidelines
```

## File Descriptions

### Backend Files

**app.py**
- Main Flask application
- API route definitions
- Authentication endpoints
- Music map generation
- Recommendation endpoints

**config.py**
- Environment variable management
- Configuration class
- Database connection settings

**ml/similarity_engine.py**
- Audio feature extraction
- Cosine similarity computation
- K-Means clustering
- PCA/t-SNE dimensionality reduction
- Graph network construction

**ml/recommendation_engine.py**
- User profile building
- Content-based filtering
- Collaborative filtering
- Hybrid recommendations
- Mood-based playlist generation

**services/spotify_service.py**
- Spotify API authentication
- Track feature fetching
- Artist information retrieval
- Search functionality

**models/schemas.py**
- MongoDB collection schemas
- Data structure definitions

### Frontend Files

**App.jsx**
- Main application component
- Router configuration
- Authentication state management

**pages/MusicMap.jsx**
- D3.js visualization
- Interactive music universe map
- Zoom and pan functionality
- Song detail display

**pages/Discover.jsx**
- Search interface
- Song discovery
- Recommendation display

**pages/Playlists.jsx**
- AI playlist generator
- Mood selection
- Playlist display

**pages/Analytics.jsx**
- User statistics
- Genre distribution charts
- Cluster visualization
- Listening patterns

**components/Navbar.jsx**
- Navigation menu
- Route links
- User profile access

## Key Technologies by Layer

### Frontend
- **React 18**: UI framework
- **React Router**: Navigation
- **D3.js**: Data visualization
- **Tailwind CSS**: Styling
- **Axios**: HTTP client
- **Recharts**: Analytics charts
- **Vite**: Build tool

### Backend
- **Flask**: Web framework
- **Flask-CORS**: Cross-origin requests
- **Flask-PyMongo**: MongoDB integration
- **Spotipy**: Spotify API client
- **Bcrypt**: Password hashing
- **PyJWT**: Token authentication

### Machine Learning
- **Scikit-learn**: ML algorithms
- **Pandas**: Data manipulation
- **NumPy**: Numerical computing
- **NetworkX**: Graph analysis

### Database
- **MongoDB**: NoSQL database
- **PyMongo**: Python driver

## Data Flow

1. **User Authentication**
   ```
   Frontend → POST /api/auth/login → Backend → MongoDB → JWT Token → Frontend
   ```

2. **Music Map Generation**
   ```
   Frontend → POST /api/map/generate → Backend → ML Engine → MongoDB → Frontend
   ```

3. **Song Search**
   ```
   Frontend → GET /api/songs/search → Backend → MongoDB → Frontend
   ```

4. **Playlist Generation**
   ```
   Frontend → POST /api/playlists/generate → Backend → ML Engine → MongoDB → Frontend
   ```

5. **Recommendations**
   ```
   Frontend → GET /api/recommendations/:userId → Backend → ML Engine → MongoDB → Frontend
   ```

## Development Workflow

1. **Setup Environment**
   - Install dependencies (backend & frontend)
   - Configure environment variables
   - Start MongoDB

2. **Backend Development**
   - Run Flask server: `python app.py`
   - Test API endpoints with Postman/curl
   - Monitor logs for errors

3. **Frontend Development**
   - Run dev server: `npm run dev`
   - Hot reload for instant feedback
   - Test UI components

4. **ML Development**
   - Experiment in Jupyter notebooks
   - Implement in ml/ modules
   - Test with sample data

5. **Integration Testing**
   - Test full stack flow
   - Verify API responses
   - Check UI updates

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database indexes created
- [ ] API endpoints tested
- [ ] Frontend build optimized
- [ ] CORS configured correctly
- [ ] Authentication working
- [ ] ML models trained
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Monitoring setup

## Extending the Project

### Adding New Features

1. **New ML Algorithm**
   - Add to `ml/` directory
   - Import in `app.py`
   - Create API endpoint
   - Update frontend

2. **New Page**
   - Create in `src/pages/`
   - Add route in `App.jsx`
   - Add navigation in `Navbar.jsx`

3. **New API Endpoint**
   - Define route in `app.py`
   - Implement logic
   - Update frontend API calls

### Code Organization Best Practices

- Keep components small and focused
- Separate business logic from UI
- Use meaningful variable names
- Comment complex algorithms
- Write reusable functions
- Follow consistent naming conventions
