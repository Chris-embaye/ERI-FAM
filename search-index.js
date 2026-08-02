/**
 * ERI-FAM v2.0 — Smart Search Indexing
 * Enables fast, fuzzy search through large music libraries
 */

class SearchIndex {
  constructor() {
    this.index = new Map();
    this.trackMap = new Map();
  }

  /**
   * Add track to search index
   */
  addTrack(track) {
    if (!track || !track.id) return;

    this.trackMap.set(track.id, track);

    const tokens = this.tokenize(track);
    tokens.forEach(token => {
      if (!this.index.has(token)) {
        this.index.set(token, new Set());
      }
      this.index.get(token).add(track.id);
    });
  }

  /**
   * Remove track from index
   */
  removeTrack(trackId) {
    const track = this.trackMap.get(trackId);
    if (!track) return;

    const tokens = this.tokenize(track);
    tokens.forEach(token => {
      const set = this.index.get(token);
      if (set) {
        set.delete(trackId);
        if (set.size === 0) {
          this.index.delete(token);
        }
      }
    });

    this.trackMap.delete(trackId);
  }

  /**
   * Search by query (fuzzy matching)
   */
  search(query, limit = 50) {
    if (!query || query.length < 1) return [];

    const queryTokens = query.toLowerCase().trim().split(/\s+/);
    const results = new Map();

    queryTokens.forEach((queryToken) => {
      // Exact match
      if (this.index.has(queryToken)) {
        this.index.get(queryToken).forEach(trackId => {
          results.set(trackId, (results.get(trackId) || 0) + 10);
        });
      }

      // Prefix match
      this.index.forEach((trackIds, indexToken) => {
        if (indexToken.startsWith(queryToken)) {
          trackIds.forEach(trackId => {
            results.set(trackId, (results.get(trackId) || 0) + 5);
          });
        }
      });

      // Fuzzy match (Levenshtein distance)
      const fuzzyMatches = this.fuzzySearch(queryToken);
      fuzzyMatches.forEach((trackId, score) => {
        results.set(trackId, (results.get(trackId) || 0) + score);
      });
    });

    // Sort by score and return
    return Array.from(results.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([trackId]) => this.trackMap.get(trackId))
      .filter(Boolean);
  }

  /**
   * Fuzzy search using Levenshtein distance
   */
  fuzzySearch(query, threshold = 2) {
    const results = new Map();
    const maxDistance = Math.ceil(query.length * 0.3);

    this.index.forEach((trackIds, token) => {
      const distance = this.levenshtein(query, token);
      if (distance <= maxDistance) {
        trackIds.forEach(trackId => {
          results.set(trackId, (results.get(trackId) || 0) + (10 - distance));
        });
      }
    });

    return results;
  }

  /**
   * Levenshtein distance (edit distance)
   */
  levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Tokenize track for indexing
   */
  tokenize(track) {
    const tokens = new Set();
    const fields = ['title', 'artist', 'album', 'genre', 'year'];

    fields.forEach(field => {
      if (track[field]) {
        const value = String(track[field]).toLowerCase().trim();
        value.split(/[\s\-_\.]+/).forEach(token => {
          if (token.length > 0) {
            tokens.add(token);
          }
        });
      }
    });

    return tokens;
  }

  /**
   * Clear all indexes
   */
  clear() {
    this.index.clear();
    this.trackMap.clear();
  }

  /**
   * Rebuild index from tracks array
   */
  rebuildFromTracks(tracks) {
    this.clear();
    if (Array.isArray(tracks)) {
      tracks.forEach(track => this.addTrack(track));
    }
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      tokenCount: this.index.size,
      trackCount: this.trackMap.size,
      avgTokensPerTrack: this.index.size / (this.trackMap.size || 1)
    };
  }
}

const searchIndex = new SearchIndex();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SearchIndex, searchIndex };
}
