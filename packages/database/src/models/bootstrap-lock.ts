import { PrismaClientKnownRequestError, prismaClient } from '../client';

// Fixed primary key of the single row this table ever holds. The row itself is the lock:
// whichever concurrent signup request manages to insert it first wins the bootstrap slot.
const BOOTSTRAP_LOCK_ID = 'bootstrap';

// A lock older than this can no longer belong to a signup that is still in flight. It is
// reclaimed so a crashed or failed bootstrap attempt does not lock the instance out forever.
const BOOTSTRAP_LOCK_STALE_MS = 30_000;

export const dbBootstrapLock = {
  /**
   * Attempts to atomically claim the bootstrap lock.
   *
   * The insert itself is the compare-and-set: Postgres enforces the primary key
   * uniqueness even across concurrent transactions and replicas, so at most one caller
   * ever observes a successful insert for a given lock lifetime.
   * @returns true if this call claimed the lock, false if it is already held.
   */
  tryAcquire: async (): Promise<boolean> => {
    try {
      await prismaClient.bootstrapLock.create({ data: { id: BOOTSTRAP_LOCK_ID } });
      return true;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  },

  /**
   * Reclaims the bootstrap lock if it is old enough to no longer belong to an in-flight
   * signup, then tries to claim it again.
   *
   * This is the recovery path for a lock whose owning request crashed or failed after
   * claiming the lock but before creating its user.
   *
   * The staleness check and the delete run as a single conditional DELETE, so the check
   * cannot go out of date between reading and deleting. When two callers race on the same
   * stale lock, only one of them deletes a row; the other sees a count of 0 and backs off
   * instead of deleting the lock the winner has just inserted.
   * @returns true if this call reclaimed and re-claimed the lock, false otherwise.
   */
  reclaimIfStale: async (): Promise<boolean> => {
    const staleBefore = new Date(Date.now() - BOOTSTRAP_LOCK_STALE_MS);
    const { count } = await prismaClient.bootstrapLock.deleteMany({
      where: { id: BOOTSTRAP_LOCK_ID, createdAt: { lt: staleBefore } },
    });
    if (count === 0) {
      return false;
    }

    return dbBootstrapLock.tryAcquire();
  },
};
