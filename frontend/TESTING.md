# SEU-WuHub Frontend Testing Guide

## Overview

This document describes the minimal test setup and first batch of unit tests for the SEU-WuHub frontend project.

## Test Environment

### Tools Used
- **Vitest**: Fast unit testing framework
- **Testing Library**: React component testing utilities
- **jsdom**: DOM implementation for testing
- **@vitest/coverage-v8**: Code coverage reporting

### Configuration Files

#### 1. vitest.config.ts
Main test configuration file with:
- jsdom environment
- React plugin
- Path aliases (@/ -> src/)
- Coverage settings (50% threshold for all metrics)
- Test setup file reference

#### 2. src/__tests__/setup.ts
Global test setup that:
- Imports jest-dom matchers
- Cleans up after each test
- Mocks localStorage for testing

## Test Scripts

Add these to your package.json scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  }
}
```

## Running Tests

### Install Dependencies First
```bash
cd frontend
npm install
# or
pnpm install
```

### Run All Tests
```bash
npm test
# or
pnpm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
# or
pnpm test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
# or
pnpm test:coverage
```

## Test Files

### 1. src/__tests__/favorites.test.ts
Tests for favorites management functionality.

**Coverage:**
- `getFavorites()` - Returns empty array when localStorage is empty
- `getFavorites()` - Returns stored favorites when localStorage has data
- `getFavorites()` - Returns empty array when localStorage has invalid JSON
- `addFavorite()` - Adds a new favorite
- `addFavorite()` - Does not add duplicate favorite
- `removeFavorite()` - Removes a favorite by id
- `isFavorite()` - Returns true when article is favorited
- `isFavorite()` - Returns false when article is not favorited
- `toggleFavorite()` - Adds favorite when not favorited
- `toggleFavorite()` - Removes favorite when already favorited
- `clearAllFavorites()` - Clears all favorites

### 2. src/__tests__/api.test.ts
Tests for API search parameter construction.

**Coverage:**
- `buildSearchQueryParams()` - Handles only q parameter
- `buildSearchQueryParams()` - Handles empty q parameter
- `buildSearchQueryParams()` - Handles page_size parameter
- `buildSearchQueryParams()` - Uses default page_size when not provided
- `buildSearchQueryParams()` - Handles start_date and end_date directly
- `buildSearchQueryParams()` - Converts time=today to date range
- `buildSearchQueryParams()` - Converts time=7days to date range
- `buildSearchQueryParams()` - Converts time=30days to date range
- `buildSearchQueryParams()` - Converts time=6months to date range
- `buildSearchQueryParams()` - Converts time=1year to date range
- `buildSearchQueryParams()` - Does not override explicit dates with time parameter
- `buildSearchQueryParams()` - Handles invalid time parameter
- `buildSearchParams()` - Handles empty parameters
- `buildSearchParams()` - Handles only page parameter
- `buildSearchParams()` - Handles only page_size parameter
- `buildSearchParams()` - Handles only category parameter
- `buildSearchParams()` - Handles only tags parameter
- `buildSearchParams()` - Handles all parameters
- `buildSearchParams()` - Does not include undefined values
- `buildSearchUrlParams()` - Handles only q parameter
- `buildSearchUrlParams()` - Handles empty q parameter
- `buildSearchUrlParams()` - Handles page_size parameter
- `buildSearchUrlParams()` - Handles start_date and end_date
- `buildSearchUrlParams()` - Handles time parameter
- `buildSearchUrlParams()` - Handles all parameters

### 3. src/__tests__/utils.test.ts
Tests for utility functions.

**Coverage:**
- `cn()` - Merges single class
- `cn()` - Merges multiple classes
- `cn()` - Handles empty strings
- `cn()` - Handles undefined and null
- `cn()` - Handles conditional classes with undefined
- `cn()` - Handles conditional classes with truthy value
- `cn()` - Handles arrays of classes
- `cn()` - Handles objects with boolean values
- `cn()` - Handles mixed inputs
- `cn()` - Handles tailwind merge - remove conflicting classes
- `cn()` - Handles complex tailwind class combinations
- `cn()` - Handles empty input
- `cn()` - Handles all empty inputs

### 4. src/__tests__/article-card.test.tsx
Lightweight component tests for ArticleCard.

**Coverage:**
- Renders article title
- Renders article summary
- Renders article time
- Renders article source
- Renders all tags
- Renders star icon
- Calls toggleFavorite when star button is clicked
- Renders with favorited state when isFavorite returns true
- Stops propagation when star button is clicked

## Code Changes Made

### 1. src/lib/api.ts
Added three pure functions for testing:
- `buildSearchQueryParams()` - Converts search parameters to query params
- `buildSearchParams()` - Builds URLSearchParams for article list
- `buildSearchUrlParams()` - Builds URLSearchParams for search

These functions were extracted from the existing `searchArticles()` method to make them testable without mocking fetch.

### 2. package.json
Added test dependencies:
- @testing-library/jest-dom
- @testing-library/react
- @testing-library/user-event
- @vitejs/plugin-react
- @vitest/coverage-v8
- jsdom
- happy-dom
- vitest

Added test scripts:
- test
- test:watch
- test:coverage

## Coverage Strategy

### Current Thresholds
- Statements: 50%
- Branches: 50%
- Functions: 50%
- Lines: 50%

### Exclusions
- node_modules/
- src/__tests__/
- **/*.d.ts
- **/*.config.*
- **/mockData
- src/app/** (Next.js app directory)
- src/components/ui/** (UI components from shadcn/ui)

### Rationale
The 50% threshold is a pragmatic starting point that:
- Ensures core business logic (lib directory) is tested
- Doesn't block development with unrealistic expectations
- Can be increased gradually as the test suite grows
- Focuses on high-value tests rather than coverage numbers

## Testing Principles Followed

1. **Small Iterations**: Tests are added incrementally without major refactoring
2. **No Architecture Changes**: Business code structure remains unchanged
3. **High-Value Tests First**: Priority on pure functions, utilities, and business logic
4. **Minimal Mocking**: Only localStorage and necessary dependencies are mocked
5. **No E2E Tests**: Focus on unit and component tests only
6. **No Snapshot Tests**: Prefer explicit assertions over snapshots
7. **Test-Ready Code**: Extracted testable functions from complex logic

## Next Steps

To expand the test suite:

1. Add more utility function tests
2. Test API response parsing logic
3. Add more component tests as needed
4. Gradually increase coverage thresholds
5. Add integration tests for critical user flows

## Troubleshooting

### Tests fail to run
Ensure all dependencies are installed:
```bash
npm install
```

### Coverage not generating
Make sure @vitest/coverage-v8 is installed and vitest.config.ts has coverage configuration.

### Path resolution issues
Check that vitest.config.ts has the correct path aliases configured.

## Notes

- This is a minimal test setup designed to be expanded over time
- Focus on testing business logic and critical user interactions
- Don't chase 100% coverage - aim for meaningful tests
- Keep mocks simple and focused
- Tests should be fast and reliable
