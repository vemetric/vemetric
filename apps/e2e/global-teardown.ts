import { disconnectDb } from './fixtures/db';

/**
 * Global teardown - runs after all tests complete
 */
async function globalTeardown(): Promise<void> {
  // Disconnect from the database
  await disconnectDb();
}

export default globalTeardown;
