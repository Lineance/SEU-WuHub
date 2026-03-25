/**
 * Favorites Management - localStorage-based persistence
 *
 * Responsibilities:
 * - Add/remove favorites
 * - Check if article is favorited
 * - Get all favorites list
 */

export interface FavoriteArticle {
  id: string
  title: string
  source: string
  published_at: string
  summary?: string
  tags?: string[]
}

const FAVORITES_KEY = "seu-wuhub-favorites"

function _getFavoritesFromStorage(): FavoriteArticle[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(FAVORITES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveFavorites(favorites: FavoriteArticle[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  } catch (e) {
    console.error("Failed to save favorites:", e)
  }
}

export function isFavorite(articleId: string): boolean {
  const favorites = _getFavoritesFromStorage()
  return favorites.some((fav) => fav.id === articleId)
}

export function addFavorite(article: FavoriteArticle): void {
  const favorites = _getFavoritesFromStorage()
  if (!favorites.some((fav) => fav.id === article.id)) {
    favorites.unshift(article) // Add to beginning
    saveFavorites(favorites)
  }
}

export function removeFavorite(articleId: string): void {
  const favorites = _getFavoritesFromStorage()
  const filtered = favorites.filter((fav) => fav.id !== articleId)
  saveFavorites(filtered)
}

export function toggleFavorite(article: FavoriteArticle): void {
  if (isFavorite(article.id)) {
    removeFavorite(article.id)
  } else {
    addFavorite(article)
  }
}

export function getAllFavorites(): FavoriteArticle[] {
  return _getFavoritesFromStorage()
}

// Alias for backward compatibility
export const getFavorites = getAllFavorites

export function clearAllFavorites(): void {
  saveFavorites([])
}

export function getFavoritesCount(): number {
  return _getFavoritesFromStorage().length
}
