# Machine Learning Pipeline Documentation

## Overview

Melody Map uses unsupervised learning and recommendation algorithms to create an intelligent music discovery system.

## Audio Feature Analysis

### Feature Vector (8 dimensions)

Each song is represented as a feature vector:

```python
features = [
    tempo,           # BPM (60-200)
    energy,          # 0.0-1.0
    danceability,    # 0.0-1.0
    valence,         # 0.0-1.0 (happiness)
    acousticness,    # 0.0-1.0
    instrumentalness,# 0.0-1.0
    loudness,        # -60 to 0 dB
    speechiness      # 0.0-1.0
]
```

### Feature Normalization

StandardScaler is used to normalize features to zero mean and unit variance:

```python
scaler = StandardScaler()
normalized_features = scaler.fit_transform(features)
```

This ensures all features contribute equally to similarity calculations.

## Similarity Computation

### Cosine Similarity

Measures the cosine of the angle between two feature vectors:

```
similarity(A, B) = (A · B) / (||A|| × ||B||)
```

Range: -1 to 1 (higher = more similar)

```python
from sklearn.metrics.pairwise import cosine_similarity

similarity_matrix = cosine_similarity(normalized_features)
```

### Finding Similar Songs

```python
def find_similar_songs(song_features, all_features, top_k=10):
    similarities = cosine_similarity([song_features], all_features)[0]
    similar_indices = np.argsort(similarities)[::-1][1:top_k+1]
    return similar_indices, similarities[similar_indices]
```

## Clustering Algorithm

### K-Means Clustering

Groups songs into K clusters based on feature similarity:

```python
from sklearn.cluster import KMeans

kmeans = KMeans(n_clusters=10, random_state=42, n_init=10)
clusters = kmeans.fit_predict(normalized_features)
```

**Parameters:**
- n_clusters: 10 (adjustable based on dataset size)
- random_state: 42 (reproducibility)
- n_init: 10 (number of initializations)

**Cluster Characteristics:**
Each cluster represents a distinct music style/mood profile.

```python
def get_cluster_characteristics(features, clusters):
    df = pd.DataFrame(features, columns=feature_columns)
    df['cluster'] = clusters
    return df.groupby('cluster').mean()
```

## Dimensionality Reduction

### PCA (Principal Component Analysis)

Reduces 8D feature space to 2D for visualization:

```python
from sklearn.decomposition import PCA

pca = PCA(n_components=2, random_state=42)
coordinates_2d = pca.fit_transform(normalized_features)
```

**Advantages:**
- Fast computation
- Preserves global structure
- Deterministic results

### t-SNE (Alternative)

Non-linear dimensionality reduction for better local structure:

```python
from sklearn.manifold import TSNE

tsne = TSNE(n_components=2, random_state=42, perplexity=30)
coordinates_2d = tsne.fit_transform(normalized_features)
```

**Advantages:**
- Better cluster separation
- Preserves local neighborhoods

**Disadvantages:**
- Slower computation
- Non-deterministic

## Recommendation Algorithms

### 1. Content-Based Filtering

Recommends songs similar to user's liked songs:

```python
def content_based_filtering(user_profile, songs_data, top_k=20):
    # User profile = average features of liked songs
    profile_vector = compute_user_profile(user_interactions)
    
    # Compute similarity with all songs
    similarities = cosine_similarity([profile_vector], all_song_features)
    
    # Return top K
    return top_k_songs
```

**Algorithm:**
1. Build user taste profile (average audio features)
2. Compute cosine similarity with all songs
3. Rank by similarity score
4. Return top recommendations

### 2. Collaborative Filtering

Recommends songs liked by similar users:

```python
def collaborative_filtering(user_id, all_interactions, top_k=20):
    # Find users with similar taste
    similar_users = find_similar_users(user_id, all_interactions)
    
    # Aggregate their liked songs
    recommendations = aggregate_similar_user_songs(similar_users)
    
    return top_k_recommendations
```

**Algorithm:**
1. Find users who liked same songs
2. Collect songs liked by similar users
3. Weight by number of similar users
4. Return top recommendations

### 3. Hybrid Recommendation

Combines content-based and collaborative filtering:

```python
def hybrid_recommendation(user_id, user_profile, all_interactions, songs_data):
    content_recs = content_based_filtering(user_profile, songs_data)
    collab_recs = collaborative_filtering(user_id, all_interactions)
    
    # Weighted combination
    combined_scores = {}
    for rec in content_recs:
        combined_scores[rec['song_id']] = rec['score'] * 0.6
    
    for rec in collab_recs:
        combined_scores[rec['song_id']] += rec['score'] * 0.4
    
    return sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
```

**Weights:**
- Content-based: 60%
- Collaborative: 40%

## Mood-Based Playlist Generation

Maps moods to audio feature ranges:

```python
mood_mappings = {
    'happy': {
        'valence': (0.6, 1.0),
        'energy': (0.5, 1.0)
    },
    'sad': {
        'valence': (0.0, 0.4),
        'energy': (0.0, 0.5)
    },
    'energetic': {
        'energy': (0.7, 1.0),
        'danceability': (0.6, 1.0)
    },
    'calm': {
        'energy': (0.0, 0.4),
        'acousticness': (0.5, 1.0)
    },
    'dreamy': {
        'valence': (0.4, 0.7),
        'acousticness': (0.4, 0.8),
        'energy': (0.2, 0.6)
    }
}
```

**Algorithm:**
1. Map mood to feature constraints
2. Filter songs matching all constraints
3. Rank by relevance
4. Return playlist

## Graph-Based Network

Represents music as a graph where edges indicate similarity:

```python
import networkx as nx

def build_music_graph(songs_data, similarity_matrix, threshold=0.7):
    G = nx.Graph()
    
    # Add nodes (songs)
    for i, song in enumerate(songs_data):
        G.add_node(i, **song)
    
    # Add edges (similarity > threshold)
    for i in range(len(songs_data)):
        for j in range(i+1, len(songs_data)):
            if similarity_matrix[i][j] > threshold:
                G.add_edge(i, j, weight=similarity_matrix[i][j])
    
    return G
```

**Applications:**
- Find connected components (music communities)
- Compute centrality (influential songs)
- Shortest path between songs
- Community detection

## Performance Metrics

### Clustering Quality

```python
from sklearn.metrics import silhouette_score, davies_bouldin_score

# Silhouette Score (higher is better, range: -1 to 1)
silhouette = silhouette_score(features, clusters)

# Davies-Bouldin Index (lower is better)
db_index = davies_bouldin_score(features, clusters)
```

### Recommendation Quality

- Precision@K: Proportion of relevant items in top K
- Recall@K: Proportion of relevant items retrieved
- NDCG: Normalized Discounted Cumulative Gain
- Coverage: Percentage of catalog recommended

## Optimization Strategies

### 1. Feature Engineering
- Add derived features (tempo_category, energy_level)
- Feature selection (remove low-variance features)
- Polynomial features for non-linear relationships

### 2. Algorithm Tuning
- Grid search for optimal K in K-Means
- Adjust PCA components based on explained variance
- Tune similarity threshold for graph construction

### 3. Scalability
- Mini-batch K-Means for large datasets
- Approximate nearest neighbors (Annoy, FAISS)
- Incremental PCA for streaming data
- Caching similarity computations

## Future Enhancements

1. **Deep Learning**
   - Audio CNN for feature extraction
   - Autoencoders for dimensionality reduction
   - RNN for sequential playlist generation

2. **Advanced Algorithms**
   - Matrix factorization (SVD, NMF)
   - Graph neural networks
   - Reinforcement learning for playlist optimization

3. **Multi-Modal Learning**
   - Combine audio, lyrics, and metadata
   - Image analysis of album art
   - Social network analysis

4. **Real-Time Learning**
   - Online learning algorithms
   - Streaming K-Means
   - Incremental updates to user profiles
