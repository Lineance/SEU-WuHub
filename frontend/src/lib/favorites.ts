/**
 * Favorites Management
 *
 * 本地收藏功能管理，使用 localStorage 存储。
 */

export interface FavoriteArticle {
  id: string
  title: string
  url: string
  source?: string
  published_at?: string
  added_at: string
}

const FAVORITES_KEY = "seu-wuhub-favorites"

function getStoredFavorites(): FavoriteArticle[] {
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
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
}

export function getFavorites(): FavoriteArticle[] {
  return getStoredFavorites()
}

export function addFavorite(article: Omit<FavoriteArticle, "added_at">): boolean {
  const favorites = getStoredFavorites()

  if (favorites.some((fav) => fav.id === article.id)) {
    return false
  }

  favorites.push({
    ...article,
    added_at: new Date().toISOString(),
  })

  saveFavorites(favorites)
  return true
}

export function removeFavorite(articleId: string): void {
  const favorites = getStoredFavorites()
  const filtered = favorites.filter((fav) => fav.id !== articleId)
  saveFavorites(filtered)
}

export function isFavorite(articleId: string): boolean {
  const favorites = getStoredFavorites()
  return favorites.some((fav) => fav.id === articleId)
}

export function clearAllFavorites(): void {
  saveFavorites([])
}

export function toggleFavorite(article: Omit<FavoriteArticle, "added_at">): boolean {
  if (isFavorite(article.id)) {
    removeFavorite(article.id)
    return false
  } else {
    addFavorite(article)
    return true
  }
}
