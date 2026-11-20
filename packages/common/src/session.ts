export const SESSION_DURATION_MINUTES = 30;

/** Redis key of the hub's current session id for a visitor (kept for SESSION_DURATION_MINUTES after each event). */
export const sessionIdRedisKey = (projectId: bigint | string, userId: bigint | string) =>
  `sessionid:${projectId}:${userId}`;
