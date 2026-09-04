export const HOUR_IN_SECONDS = 3600;
export const GLOBE_H3_RESOLUTION = 1;
// we round the current date to the nearest 30 seconds and subtract 4 minutes and 30 seconds
export const ONLINE_USERS_INTERVAL_QUERY = 'toStartOfInterval(NOW(), INTERVAL 30 SECOND) - INTERVAL 270 SECOND';
