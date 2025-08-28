# Unit Tests with Vitest

This project includes comprehensive unit tests using Vitest for the contact management API.

## Test Structure

The test suite is organized into the following structure:

```
src/test/
├── unit/                          # Unit tests that mock external dependencies
│   └── createContact.test.ts      # Tests for POST /contacts endpoint
├── routes/                        # Integration tests (require database)
│   └── contacts/                  # Contact route tests
├── weather/                       # Weather API integration tests
│   └── weatherApi.test.ts         # Tests for weather API functionality
├── database/                      # Database schema tests
├── utils.ts                       # Test utilities and helpers
└── setup.ts                       # Test setup and database configuration
```

## Running Tests

### Unit Tests (Recommended)

Unit tests use mocks and don't require a database connection:

```bash
# Run unit tests once
npm run test:unit

# Run unit tests in watch mode
npm run test:unit:watch

# Run unit tests with coverage
npm run test:unit:coverage
```

### Integration Tests (Requires Database)

Integration tests require a PostgreSQL database to be running:

```bash
# Start the database
docker-compose up -d

# Run integration tests
npm test
```

## Test Features

### Current Test Coverage

#### POST /contacts Unit Tests ✅

- ✅ Create contact with valid data
- ✅ Create contact with phone numbers
- ✅ Validation for missing required fields
- ✅ Validation for invalid email format
- ✅ Validation for nome too short
- ✅ Validation for invalid phone number
- ✅ Duplicate email error handling

#### Weather API Integration Tests ✅

- ✅ Successful API call to HG Brasil Weather API
- ✅ Handle special characters in city names (URL encoding)
- ✅ Handle API error responses (404, 500, etc.)
- ✅ Handle network errors and timeouts
- ✅ Handle invalid API key responses
- ✅ Handle malformed JSON responses
- ✅ Weather suggestion generation for cold weather
- ✅ Weather suggestion generation for hot sunny weather
- ✅ Weather suggestion generation for rainy weather
- ✅ Weather suggestion generation for hot rainy weather
- ✅ Real API integration test (optional, skipped in CI)

### Test Categories

1. **Validation Tests**: Test request validation using Zod schemas
2. **Success Cases**: Test successful operations with mocked database
3. **Error Handling**: Test various error scenarios and proper error responses
4. **Edge Cases**: Test boundary conditions and edge cases

## Mock Strategy

The unit tests use Vitest's mocking capabilities to:

- Mock the database client (`src/database/client.ts`)
- Mock external APIs (HG Brasil Weather API)
- Mock global `fetch` for network request testing
- Provide controlled responses for different test scenarios

## Test Utilities

- `createTestApp()`: Creates a Fastify app instance for testing
- Database mocking with proper UUID generation
- Weather API mocking for different weather scenarios

## Adding New Tests

1. **Unit Tests**: Add to `src/test/unit/` directory
2. **Mock Database Responses**: Use valid UUIDs and proper data structures
3. **Test Naming**: Use descriptive test names following the pattern "should [action] when/for [condition]"

## Example Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import supertest from "supertest";
import { server } from "../../app";

// Mock external dependencies
vi.mock("../../database/client.ts", () => ({
  db: {
    // Mock implementation
  },
}));

describe("Feature Tests", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = server;
    await app.ready();
  });

  it("should do something when condition is met", async () => {
    // Test implementation
  });
});
```

## Benefits of This Testing Approach

1. **Fast Execution**: Unit tests run quickly without database overhead
2. **Reliable**: Not dependent on external services or database state
3. **Isolated**: Each test is independent and doesn't affect others
4. **Comprehensive**: Tests both success and failure scenarios
5. **Easy to Debug**: Clear error messages and focused test scope

## Next Steps

To expand the test suite:

1. Add unit tests for other endpoints (GET, PUT, DELETE)
2. ✅ ~~Add tests for the weather API integration~~ (COMPLETED)
3. Add tests for database utilities and schema validation
4. Add performance tests for high-load scenarios
5. Add end-to-end tests with real database integration
