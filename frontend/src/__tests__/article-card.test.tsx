import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArticleCard } from '../components/article-card'

vi.mock('../lib/favorites', () => ({
  isFavorite: vi.fn(),
  toggleFavorite: vi.fn(),
}))

import { isFavorite, toggleFavorite } from '../lib/favorites'

describe('ArticleCard', () => {
  const mockProps = {
    id: '1',
    title: 'Test Article Title',
    summary: 'This is a test summary for the article.',
    time: '2024-01-15',
    source: 'Test Source',
    tags: ['tag1', 'tag2'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFavorite).mockReturnValue(false)
    vi.mocked(toggleFavorite).mockReturnValue(true)
  })

  it('should render article title', () => {
    render(<ArticleCard {...mockProps} />)
    expect(screen.getByText('Test Article Title')).toBeInTheDocument()
  })

  it('should render article summary', () => {
    render(<ArticleCard {...mockProps} />)
    expect(screen.getByText('This is a test summary for the article.')).toBeInTheDocument()
  })

  it('should render article time', () => {
    render(<ArticleCard {...mockProps} />)
    expect(screen.getByText('2024-01-15')).toBeInTheDocument()
  })

  it('should render article source', () => {
    render(<ArticleCard {...mockProps} />)
    expect(screen.getByText('Test Source')).toBeInTheDocument()
  })

  it('should render all tags', () => {
    render(<ArticleCard {...mockProps} />)
    expect(screen.getByText('tag1')).toBeInTheDocument()
    expect(screen.getByText('tag2')).toBeInTheDocument()
  })

  it('should render star icon', () => {
    render(<ArticleCard {...mockProps} />)
    const starButton = screen.getByRole('button')
    expect(starButton).toBeInTheDocument()
  })

  it('should call toggleFavorite when star button is clicked', () => {
    render(<ArticleCard {...mockProps} />)
    const starButton = screen.getByRole('button')
    fireEvent.click(starButton)
    expect(toggleFavorite).toHaveBeenCalledWith({
      id: '1',
      title: 'Test Article Title',
      url: '',
      source: 'Test Source',
      published_at: '2024-01-15',
      added_at: expect.any(String),
    })
  })

  it('should render with favorited state when isFavorite returns true', () => {
    vi.mocked(isFavorite).mockReturnValue(true)
    render(<ArticleCard {...mockProps} />)
    const starButton = screen.getByRole('button')
    expect(starButton).toBeInTheDocument()
  })

  it('should stop propagation when star button is clicked', () => {
    const mockStopPropagation = vi.fn()
    render(<ArticleCard {...mockProps} />)
    const starButton = screen.getByRole('button')
    
    const clickEvent = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(clickEvent, 'stopPropagation', {
      value: mockStopPropagation,
      writable: true,
    })
    
    fireEvent(starButton, clickEvent)
    expect(mockStopPropagation).toHaveBeenCalled()
  })
})
