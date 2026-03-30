import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getFavorites, addFavorite, removeFavorite, isFavorite, toggleFavorite, clearAllFavorites } from '../lib/favorites'

describe('favorites.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.localStorage.getItem.mockReturnValue(null)
  })

  describe('getFavorites', () => {
    it('should return empty array when localStorage is empty', () => {
      const result = getFavorites()
      expect(result).toEqual([])
    })

    it('should return stored favorites when localStorage has data', () => {
      const mockFavorites = [
        { id: '1', title: 'Test Article', url: 'http://test.com', added_at: '2024-01-01' }
      ]
      global.localStorage.getItem.mockReturnValue(JSON.stringify(mockFavorites))

      const result = getFavorites()
      expect(result).toEqual(mockFavorites)
    })

    it('should return empty array when localStorage has invalid JSON', () => {
      global.localStorage.getItem.mockReturnValue('invalid json')

      const result = getFavorites()
      expect(result).toEqual([])
    })
  })

  describe('addFavorite', () => {
    it('should add a new favorite', () => {
      const article = { id: '1', title: 'Test Article', url: 'http://test.com' }
      const result = addFavorite(article)

      expect(result).toBe(true)
      expect(global.localStorage.setItem).toHaveBeenCalled()
    })

    it('should not add duplicate favorite', () => {
      const article = { id: '1', title: 'Test Article', url: 'http://test.com' }
      global.localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: '1', title: 'Test Article', url: 'http://test.com', added_at: '2024-01-01' }
      ]))

      const result = addFavorite(article)
      expect(result).toBe(false)
    })
  })

  describe('removeFavorite', () => {
    it('should remove a favorite by id', () => {
      const mockFavorites = [
        { id: '1', title: 'Test Article', url: 'http://test.com', added_at: '2024-01-01' },
        { id: '2', title: 'Test Article 2', url: 'http://test2.com', added_at: '2024-01-01' }
      ]
      global.localStorage.getItem.mockReturnValue(JSON.stringify(mockFavorites))

      removeFavorite('1')
      expect(global.localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('isFavorite', () => {
    it('should return true when article is favorited', () => {
      const mockFavorites = [
        { id: '1', title: 'Test Article', url: 'http://test.com', added_at: '2024-01-01' }
      ]
      global.localStorage.getItem.mockReturnValue(JSON.stringify(mockFavorites))

      const result = isFavorite('1')
      expect(result).toBe(true)
    })

    it('should return false when article is not favorited', () => {
      const mockFavorites = [
        { id: '1', title: 'Test Article', url: 'http://test.com', added_at: '2024-01-01' }
      ]
      global.localStorage.getItem.mockReturnValue(JSON.stringify(mockFavorites))

      const result = isFavorite('2')
      expect(result).toBe(false)
    })
  })

  describe('toggleFavorite', () => {
    it('should add favorite when not favorited', () => {
      const article = { id: '1', title: 'Test Article', url: 'http://test.com' }
      global.localStorage.getItem.mockReturnValue('[]')

      const result = toggleFavorite(article)
      expect(result).toBe(true)
      expect(global.localStorage.setItem).toHaveBeenCalled()
    })

    it('should remove favorite when already favorited', () => {
      const article = { id: '1', title: 'Test Article', url: 'http://test.com' }
      global.localStorage.getItem.mockReturnValue(JSON.stringify([
        { id: '1', title: 'Test Article', url: 'http://test.com', added_at: '2024-01-01' }
      ]))

      const result = toggleFavorite(article)
      expect(result).toBe(false)
      expect(global.localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('clearAllFavorites', () => {
    it('should clear all favorites', () => {
      clearAllFavorites()
      expect(global.localStorage.setItem).toHaveBeenCalledWith('seu-wuhub-favorites', '[]')
    })
  })
})
