import { describe, it, expect, beforeEach } from 'vitest'
import { buildSearchQueryParams, buildSearchParams, buildSearchUrlParams } from '../lib/api'

describe('api.ts - Search Parameters', () => {
  describe('buildSearchQueryParams', () => {
    it('should handle only q parameter', () => {
      const result = buildSearchQueryParams({ q: 'test query' })
      expect(result).toEqual({
        query: 'test query',
        limit: 20,
        start_date: undefined,
        end_date: undefined,
      })
    })

    it('should handle empty q parameter', () => {
      const result = buildSearchQueryParams({})
      expect(result.query).toBe('')
    })

    it('should handle page_size parameter', () => {
      const result = buildSearchQueryParams({ q: 'test', page_size: 50 })
      expect(result.limit).toBe(50)
    })

    it('should use default page_size when not provided', () => {
      const result = buildSearchQueryParams({ q: 'test' })
      expect(result.limit).toBe(20)
    })

    it('should handle start_date and end_date directly', () => {
      const result = buildSearchQueryParams({
        q: 'test',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      })
      expect(result.start_date).toBe('2024-01-01')
      expect(result.end_date).toBe('2024-12-31')
    })

    it('should convert time=today to date range', () => {
      const result = buildSearchQueryParams({ q: 'test', time: 'today' })
      expect(result.start_date).toBeDefined()
      expect(result.end_date).toBeDefined()
    })

    it('should convert time=7days to date range', () => {
      const result = buildSearchQueryParams({ q: 'test', time: '7days' })
      expect(result.start_date).toBeDefined()
      expect(result.end_date).toBeDefined()
    })

    it('should convert time=30days to date range', () => {
      const result = buildSearchQueryParams({ q: 'test', time: '30days' })
      expect(result.start_date).toBeDefined()
      expect(result.end_date).toBeDefined()
    })

    it('should convert time=6months to date range', () => {
      const result = buildSearchQueryParams({ q: 'test', time: '6months' })
      expect(result.start_date).toBeDefined()
      expect(result.end_date).toBeDefined()
    })

    it('should convert time=1year to date range', () => {
      const result = buildSearchQueryParams({ q: 'test', time: '1year' })
      expect(result.start_date).toBeDefined()
      expect(result.end_date).toBeDefined()
    })

    it('should not override explicit dates with time parameter', () => {
      const result = buildSearchQueryParams({
        q: 'test',
        time: '7days',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      })
      expect(result.start_date).toBe('2024-01-01')
      expect(result.end_date).toBe('2024-12-31')
    })

    it('should handle invalid time parameter', () => {
      const result = buildSearchQueryParams({ q: 'test', time: 'invalid' })
      expect(result.start_date).toBeUndefined()
      expect(result.end_date).toBeUndefined()
    })
  })

  describe('buildSearchParams', () => {
    it('should handle empty parameters', () => {
      const result = buildSearchParams({})
      expect(result.toString()).toBe('')
    })

    it('should handle only page parameter', () => {
      const result = buildSearchParams({ page: 2 })
      expect(result.toString()).toBe('page=2')
    })

    it('should handle only page_size parameter', () => {
      const result = buildSearchParams({ page_size: 50 })
      expect(result.toString()).toBe('page_size=50')
    })

    it('should handle only category parameter', () => {
      const result = buildSearchParams({ category: 'tech' })
      expect(result.toString()).toBe('category=tech')
    })

    it('should handle only tags parameter', () => {
      const result = buildSearchParams({ tags: 'tag1,tag2' })
      expect(result.toString()).toBe('tags=tag1%2Ctag2')
    })

    it('should handle all parameters', () => {
      const result = buildSearchParams({
        page: 2,
        page_size: 50,
        category: 'tech',
        tags: 'tag1,tag2',
      })
      const params = result.toString()
      expect(params).toContain('page=2')
      expect(params).toContain('page_size=50')
      expect(params).toContain('category=tech')
      expect(params).toContain('tags=tag1%2Ctag2')
    })

    it('should not include undefined values', () => {
      const result = buildSearchParams({
        page: undefined,
        page_size: undefined,
        category: undefined,
        tags: undefined,
      })
      expect(result.toString()).toBe('')
    })
  })

  describe('buildSearchUrlParams', () => {
    it('should handle only q parameter', () => {
      const result = buildSearchUrlParams({ q: 'test query' })
      expect(result.get('q')).toBe('test query')
      expect(result.get('limit')).toBe('20')
    })

    it('should handle empty q parameter', () => {
      const result = buildSearchUrlParams({})
      expect(result.get('q')).toBe('')
      expect(result.get('limit')).toBe('20')
    })

    it('should handle page_size parameter', () => {
      const result = buildSearchUrlParams({ q: 'test', page_size: 50 })
      expect(result.toString()).toContain('limit=50')
    })

    it('should handle start_date and end_date', () => {
      const result = buildSearchUrlParams({
        q: 'test',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      })
      const params = result.toString()
      expect(params).toContain('start_date=2024-01-01')
      expect(params).toContain('end_date=2024-12-31')
    })

    it('should handle time parameter', () => {
      const result = buildSearchUrlParams({ q: 'test', time: '7days' })
      const params = result.toString()
      expect(params).toContain('start_date=')
      expect(params).toContain('end_date=')
    })

    it('should handle all parameters', () => {
      const result = buildSearchUrlParams({
        q: 'test',
        page_size: 50,
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      })
      const params = result.toString()
      expect(params).toContain('q=test')
      expect(params).toContain('limit=50')
      expect(params).toContain('start_date=2024-01-01')
      expect(params).toContain('end_date=2024-12-31')
    })
  })
})
