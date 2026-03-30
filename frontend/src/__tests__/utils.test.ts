import { describe, it, expect } from 'vitest'
import { cn } from '../lib/utils'

describe('utils.ts - cn function', () => {
  it('should merge single class', () => {
    const result = cn('class1')
    expect(result).toBe('class1')
  })

  it('should merge multiple classes', () => {
    const result = cn('class1', 'class2', 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  it('should handle empty strings', () => {
    const result = cn('class1', '', 'class2')
    expect(result).toBe('class1 class2')
  })

  it('should handle undefined and null', () => {
    const result = cn('class1', undefined, null, 'class2')
    expect(result).toBe('class1 class2')
  })

  it('should handle conditional classes with undefined', () => {
    const isActive = false
    const result = cn('base-class', isActive && 'active-class')
    expect(result).toBe('base-class')
  })

  it('should handle conditional classes with truthy value', () => {
    const isActive = true
    const result = cn('base-class', isActive && 'active-class')
    expect(result).toBe('base-class active-class')
  })

  it('should handle arrays of classes', () => {
    const result = cn(['class1', 'class2'], 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  it('should handle objects with boolean values', () => {
    const result = cn({
      'class1': true,
      'class2': false,
      'class3': true,
    })
    expect(result).toBe('class1 class3')
  })

  it('should handle mixed inputs', () => {
    const result = cn('class1', ['class2', 'class3'], {
      'class4': true,
      'class5': false,
    })
    expect(result).toBe('class1 class2 class3 class4')
  })

  it('should handle tailwind merge - remove conflicting classes', () => {
    const result = cn('px-4', 'px-2')
    expect(result).toBe('px-2')
  })

  it('should handle complex tailwind class combinations', () => {
    const result = cn('bg-red-500 hover:bg-red-600', 'bg-blue-500')
    expect(result).toContain('bg-blue-500')
    expect(result).toContain('hover:bg-red-600')
    expect(result).not.toContain('bg-red-500')
  })

  it('should handle empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle all empty inputs', () => {
    const result = cn('', undefined, null, false, 0)
    expect(result).toBe('')
  })
})
