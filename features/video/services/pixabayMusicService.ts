export interface PixabayTrack {
  id: number
  title: string
  artist: string
  duration: number
  preview_url: string
  audio_url: string
  tags: string[]
  genre: string
}

export interface PixabaySearchResponse {
  hits: PixabayTrack[]
  total: number
  totalHits: number
}

class PixabayMusicService {
  private apiKey: string
  private baseUrl = 'https://pixabay.com/api/audio/'

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_PIXABAY_API_KEY || ''
    if (!this.apiKey) {
      console.warn('NEXT_PUBLIC_PIXABAY_API_KEY not found. Music features will be limited.')
    }
  }

  /**
   * Search for music tracks on Pixabay
   */
  async searchMusic(query: string, options: {
    category?: string
    minDuration?: number
    maxDuration?: number
    perPage?: number
    page?: number
  } = {}): Promise<PixabaySearchResponse> {
    if (!this.apiKey) {
      throw new Error('Pixabay API key not configured')
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      q: query,
      per_page: (options.perPage || 20).toString(),
      page: (options.page || 1).toString(),
    })

    if (options.category) {
      params.append('category', options.category)
    }

    if (options.minDuration) {
      params.append('min_duration', options.minDuration.toString())
    }

    if (options.maxDuration) {
      params.append('max_duration', options.maxDuration.toString())
    }

    try {
      const response = await fetch(`${this.baseUrl}?${params}`)
      
      if (!response.ok) {
        throw new Error(`Pixabay API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        hits: data.hits.map((hit: any) => ({
          id: hit.id,
          title: hit.title,
          artist: hit.user,
          duration: hit.duration,
          preview_url: hit.preview_url,
          audio_url: hit.audio_url,
          tags: hit.tags ? hit.tags.split(', ') : [],
          genre: hit.tags ? hit.tags.split(', ')[0] : 'Unknown'
        })),
        total: data.total,
        totalHits: data.totalHits
      }
    } catch (error) {
      console.error('Error searching Pixabay music:', error)
      throw error
    }
  }

  /**
   * Get popular music tracks
   */
  async getPopularTracks(limit = 20): Promise<PixabayTrack[]> {
    try {
      const response = await this.searchMusic('popular', { perPage: limit })
      return response.hits
    } catch (error) {
      console.error('Error getting popular tracks:', error)
      return []
    }
  }

  /**
   * Get music by category
   */
  async getMusicByCategory(category: string, limit = 20): Promise<PixabayTrack[]> {
    try {
      const response = await this.searchMusic('', { 
        category, 
        perPage: limit 
      })
      return response.hits
    } catch (error) {
      console.error('Error getting music by category:', error)
      return []
    }
  }

  /**
   * Get music for specific moods/activities
   */
  async getMusicForMood(mood: string, limit = 20): Promise<PixabayTrack[]> {
    const moodQueries: Record<string, string> = {
      'happy': 'upbeat cheerful',
      'sad': 'melancholy emotional',
      'energetic': 'energetic upbeat',
      'calm': 'calm peaceful',
      'romantic': 'romantic love',
      'party': 'party dance',
      'workout': 'workout fitness',
      'study': 'study focus',
      'travel': 'travel adventure',
      'chill': 'chill relax'
    }

    const query = moodQueries[mood] || mood
    try {
      const response = await this.searchMusic(query, { perPage: limit })
      return response.hits
    } catch (error) {
      console.error('Error getting music for mood:', error)
      return []
    }
  }

  /**
   * Get trending music
   */
  async getTrendingMusic(limit = 20): Promise<PixabayTrack[]> {
    try {
      const response = await this.searchMusic('trending', { perPage: limit })
      return response.hits
    } catch (error) {
      console.error('Error getting trending music:', error)
      return []
    }
  }

  /**
   * Get music categories
   */
  getMusicCategories(): string[] {
    return [
      'music',
      'background',
      'ambient',
      'electronic',
      'acoustic',
      'classical',
      'jazz',
      'rock',
      'pop',
      'hip-hop',
      'country',
      'folk',
      'blues',
      'reggae',
      'latin',
      'world',
      'new-age',
      'soundtrack',
      'game',
      'comedy'
    ]
  }

  /**
   * Get mood categories
   */
  getMoodCategories(): string[] {
    return [
      'happy',
      'sad',
      'energetic',
      'calm',
      'romantic',
      'party',
      'workout',
      'study',
      'travel',
      'chill'
    ]
  }

  /**
   * Validate if a track is suitable for stories (duration, quality, etc.)
   */
  isTrackSuitableForStories(track: PixabayTrack): boolean {
    // Stories should be short (under 30 seconds typically)
    const maxDuration = 30
    return !!(track.duration <= maxDuration && track.audio_url && track.preview_url)
  }

  /**
   * Get license information for Pixabay music
   */
  getLicenseInfo(): {
    name: string
    description: string
    commercialUse: boolean
    attribution: boolean
    modification: boolean
  } {
    return {
      name: 'Pixabay License',
      description: 'Free for commercial and non-commercial use',
      commercialUse: true,
      attribution: false, // Attribution is optional but recommended
      modification: true,
    }
  }
}

// Export singleton instance
export const pixabayMusicService = new PixabayMusicService()

// Export the class for testing
export { PixabayMusicService }
