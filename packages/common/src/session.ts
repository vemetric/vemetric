export const SESSION_DURATION_MINUTES = 30;

export const sessionIdRedisKey = (projectId: bigint | string, userId: bigint | string) =>
  `sessionid:${projectId}:${userId}`;
