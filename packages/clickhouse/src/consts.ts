export const HOUR_IN_SECONDS = 3600;
export const GLOBE_H3_RESOLUTION = 1;
export const ONLINE_USER_INTERVAL_SECONDS = 30;
export const ONLINE_USER_LOOKBACK_SECONDS = 270;
// Keep online-state changes aligned to 30-second boundaries. Subtracting 4m30s after flooring NOW()
// produces the existing effective activity window of 4m30s up to just under 5 minutes.
export const ONLINE_USERS_INTERVAL_QUERY = `toStartOfInterval(NOW(), INTERVAL ${ONLINE_USER_INTERVAL_SECONDS} SECOND) - INTERVAL ${ONLINE_USER_LOOKBACK_SECONDS} SECOND`;
