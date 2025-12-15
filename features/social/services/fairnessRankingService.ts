/**
 * Fairness-Aware Content Ranking Service
 * Combines relevance scoring with diversity bonuses and exploration strategies
 */

interface ContentItem {
  id: string
  creator_id: string
  creator_type?: 'underrepresented' | 'verified' | 'regular'
  creator_region?: string
  language?: string
  engagement_score?: number
  created_at: string
  topic_category?: string
  [key: string]: any
}

interface DiversityBadge {
  type: 'new_voice' | 'underrepresented' | 'global_south' | 'multilingual'
  label: string
  color: string
}

interface RankingConfig {
  exploration_factor: number // 0.0 = pure relevance, 1.0 = pure exploration
  diversity_weight: number // Weight for diversity in final ranking
  temporal_decay: number // How much to favor recent content
  use_mmr: boolean // Enable Maximal Marginal Relevance
  use_bandit: boolean // Enable Multi-Armed Bandit exploration
}

interface FairnessBonus {
  underrepresented_bonus: number
  region_bonus: number
  language_bonus: number
  newness_bonus: number
}

const DEFAULT_CONFIG: RankingConfig = {
  exploration_factor: 0.5, // Balanced by default
  diversity_weight: 0.3,
  temporal_decay: 0.1,
  use_mmr: true,
  use_bandit: true
}

const DEFAULT_BONUSES: FairnessBonus = {
  underrepresented_bonus: 0.3,
  region_bonus: 0.2,
  language_bonus: 0.1,
  newness_bonus: 0.15
}

// Under-represented regions (Global South)
const UNDERREPRESENTED_REGIONS = [
  'Africa', 'Asia', 'South America', 'Central America',
  'Southeast Asia', 'Middle East', 'Caribbean', 'Pacific Islands'
]

// Non-English languages get bonus
const MINORITY_LANGUAGES = [
  'Swahili', 'Yoruba', 'Hausa', 'Amharic', 'Zulu', 'Somali',
  'French', 'Portuguese', 'Spanish', 'Arabic', 'Mandarin'
]

/**
 * Calculate relevance score based on engagement metrics
 */
function calculateRelevanceScore(content: ContentItem): number {
  const engagementScore = content.engagement_score || 0
  const ageInDays = (Date.now() - new Date(content.created_at).getTime()) / (1000 * 60 * 60 * 24)
  const recencyFactor = Math.exp(-0.1 * ageInDays) // Exponential decay

  return (engagementScore * 0.7) + (recencyFactor * 0.3)
}

/**
 * Calculate fairness bonus for under-represented content
 */
function calculateFairnessBonus(
  content: ContentItem,
  bonuses: FairnessBonus = DEFAULT_BONUSES
): number {
  let bonus = 0

  // Underrepresented creator types (new creators, minority groups, etc.)
  if (content.creator_type === 'underrepresented') {
    bonus += bonuses.underrepresented_bonus
  }

  // Regional diversity bonus (Global South)
  if (content.creator_region && UNDERREPRESENTED_REGIONS.includes(content.creator_region)) {
    bonus += bonuses.region_bonus
  }

  // Language diversity bonus (non-English)
  if (content.language && content.language !== 'English' && MINORITY_LANGUAGES.includes(content.language)) {
    bonus += bonuses.language_bonus
  }

  // Newness bonus (help new creators get visibility)
  const ageInDays = (Date.now() - new Date(content.created_at).getTime()) / (1000 * 60 * 60 * 24)
  if (ageInDays < 7) {
    bonus += bonuses.newness_bonus * (1 - ageInDays / 7)
  }

  return bonus
}

/**
 * Determine diversity badges for content
 */
export function getDiversityBadges(content: ContentItem): DiversityBadge[] {
  const badges: DiversityBadge[] = []

  // New voice badge (content created in last 48 hours)
  const ageInHours = (Date.now() - new Date(content.created_at).getTime()) / (1000 * 60 * 60)
  if (ageInHours < 48) {
    badges.push({
      type: 'new_voice',
      label: 'New Voice',
      color: 'bg-blue-100 text-blue-700'
    })
  }

  // Underrepresented creator badge
  if (content.creator_type === 'underrepresented') {
    badges.push({
      type: 'underrepresented',
      label: 'Underrepresented Creator',
      color: 'bg-purple-100 text-purple-700'
    })
  }

  // Global South badge
  if (content.creator_region && UNDERREPRESENTED_REGIONS.includes(content.creator_region)) {
    badges.push({
      type: 'global_south',
      label: 'Global South',
      color: 'bg-green-100 text-green-700'
    })
  }

  // Multilingual badge
  if (content.language && content.language !== 'English' && MINORITY_LANGUAGES.includes(content.language)) {
    badges.push({
      type: 'multilingual',
      label: content.language,
      color: 'bg-orange-100 text-orange-700'
    })
  }

  return badges
}

/**
 * Multi-Armed Bandit (UCB1 algorithm) for exploration-exploitation
 * Helps discover high-quality content from under-explored creators
 */
class MultiArmedBandit {
  private creatorStats: Map<string, { pulls: number; totalReward: number }> = new Map()

  getExplorationBonus(creatorId: string, totalPulls: number): number {
    const stats = this.creatorStats.get(creatorId) || { pulls: 0, totalReward: 0 }

    if (stats.pulls === 0) {
      return 1.0 // Maximum exploration bonus for never-shown creators
    }

    // UCB1 formula: avgReward + sqrt(2 * ln(totalPulls) / pulls)
    const avgReward = stats.totalReward / stats.pulls
    const explorationBonus = Math.sqrt((2 * Math.log(totalPulls)) / stats.pulls)

    return avgReward + explorationBonus
  }

  updateReward(creatorId: string, reward: number) {
    const stats = this.creatorStats.get(creatorId) || { pulls: 0, totalReward: 0 }
    stats.pulls += 1
    stats.totalReward += reward
    this.creatorStats.set(creatorId, stats)
  }
}

/**
 * Maximal Marginal Relevance (MMR) for diversity
 * Balances relevance with diversity to avoid echo chambers
 */
function calculateMMR(
  content: ContentItem,
  selectedContent: ContentItem[],
  relevanceScore: number,
  lambda: number = 0.5 // Trade-off between relevance and diversity
): number {
  if (selectedContent.length === 0) {
    return relevanceScore
  }

  // Calculate diversity as inverse of similarity to already selected content
  let maxSimilarity = 0
  for (const selected of selectedContent) {
    const similarity = calculateContentSimilarity(content, selected)
    maxSimilarity = Math.max(maxSimilarity, similarity)
  }

  const diversity = 1 - maxSimilarity

  // MMR formula: λ * relevance + (1 - λ) * diversity
  return lambda * relevanceScore + (1 - lambda) * diversity
}

/**
 * Calculate similarity between two content items
 * (Simple version - can be enhanced with embeddings/NLP)
 */
function calculateContentSimilarity(content1: ContentItem, content2: ContentItem): number {
  let similarity = 0

  // Same creator = high similarity
  if (content1.creator_id === content2.creator_id) {
    similarity += 0.4
  }

  // Same topic category = some similarity
  if (content1.topic_category === content2.topic_category) {
    similarity += 0.3
  }

  // Same region = some similarity
  if (content1.creator_region === content2.creator_region) {
    similarity += 0.2
  }

  // Same language = some similarity
  if (content1.language === content2.language) {
    similarity += 0.1
  }

  return Math.min(similarity, 1.0)
}

/**
 * Main ranking function with fairness and diversity
 */
export function rankContentWithFairness(
  content: ContentItem[],
  config: Partial<RankingConfig> = {},
  bonuses: Partial<FairnessBonus> = {}
): ContentItem[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const finalBonuses = { ...DEFAULT_BONUSES, ...bonuses }
  const bandit = new MultiArmedBandit()

  // Calculate initial scores for all content
  const scoredContent = content.map(item => {
    const relevanceScore = calculateRelevanceScore(item)
    const fairnessBonus = calculateFairnessBonus(item, finalBonuses)
    const explorationBonus = finalConfig.use_bandit
      ? bandit.getExplorationBonus(item.creator_id, content.length)
      : 0

    // Combined score with exploration factor
    const baseScore = relevanceScore + fairnessBonus
    const finalScore =
      (1 - finalConfig.exploration_factor) * baseScore +
      finalConfig.exploration_factor * explorationBonus

    return {
      ...item,
      _scores: {
        relevance: relevanceScore,
        fairness: fairnessBonus,
        exploration: explorationBonus,
        final: finalScore
      }
    }
  })

  // Apply MMR for diversity if enabled
  if (finalConfig.use_mmr) {
    const selectedContent: ContentItem[] = []
    const remainingContent = [...scoredContent]

    while (remainingContent.length > 0) {
      // Calculate MMR score for each remaining item
      const mmrScores = remainingContent.map(item => ({
        item,
        mmrScore: calculateMMR(
          item,
          selectedContent,
          item._scores.final,
          finalConfig.diversity_weight
        )
      }))

      // Select item with highest MMR score
      mmrScores.sort((a, b) => b.mmrScore - a.mmrScore)
      const selected = mmrScores[0].item

      selectedContent.push(selected)
      const index = remainingContent.indexOf(selected)
      remainingContent.splice(index, 1)
    }

    return selectedContent
  }

  // Simple sorting by final score if MMR is disabled
  return scoredContent.sort((a, b) => b._scores.final - a._scores.final)
}

/**
 * Update bandit rewards based on user engagement
 * Call this when user interacts with content
 */
export function updateEngagementReward(
  creatorId: string,
  engagement: 'view' | 'like' | 'comment' | 'share'
) {
  const bandit = new MultiArmedBandit()

  const rewardMap = {
    view: 0.1,
    like: 0.3,
    comment: 0.5,
    share: 0.8
  }

  bandit.updateReward(creatorId, rewardMap[engagement])
}

/**
 * Get recommended exploration factor based on user behavior
 */
export function getRecommendedExplorationFactor(userHistory: {
  diversity_score: number // 0-1, how diverse user's past interactions are
  engagement_rate: number // 0-1, how often user engages with content
}): number {
  // If user has low diversity, increase exploration
  if (userHistory.diversity_score < 0.3) {
    return 0.7 // High exploration
  }

  // If user has high diversity and engagement, balanced approach
  if (userHistory.diversity_score > 0.6 && userHistory.engagement_rate > 0.5) {
    return 0.5 // Balanced
  }

  // If user has high diversity but low engagement, focus on relevance
  if (userHistory.diversity_score > 0.6 && userHistory.engagement_rate < 0.3) {
    return 0.3 // More relevance
  }

  return 0.5 // Default balanced
}

/**
 * Export presets for different use cases
 */
export const RANKING_PRESETS = {
  PURE_RELEVANCE: { exploration_factor: 0.0, diversity_weight: 0.1, use_mmr: false, use_bandit: false },
  BALANCED: { exploration_factor: 0.5, diversity_weight: 0.3, use_mmr: true, use_bandit: true },
  HIGH_DIVERSITY: { exploration_factor: 0.7, diversity_weight: 0.5, use_mmr: true, use_bandit: true },
  EXPLORE_NEW: { exploration_factor: 0.9, diversity_weight: 0.4, use_mmr: true, use_bandit: true },
}

export default {
  rankContentWithFairness,
  updateEngagementReward,
  getRecommendedExplorationFactor,
  RANKING_PRESETS
}
