// Array of color values to choose from
const AVATAR_COLORS = [
  'red.500',
  'orange.500',
  'yellow.500',
  'green.500',
  'teal.500',
  'blue.500',
  'cyan.500',
  'purple.500',
  'pink.500',
];

// Simple hash function to get a consistent color for a user ID
export function getUserAvatarColor(userId: string | number | bigint): string {
  const userIdStr = String(userId);
  let hash = 0;
  for (let i = 0; i < userIdStr.length; i++) {
    const char = userIdStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const colorIndex = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[colorIndex];
}

// Get user's initials from display name or identifier
export function getUserInitials(displayName?: string | null, identifier?: string | null): string {
  if (displayName) {
    // Get first letter of each word, up to 2 letters
    return displayName
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  } else if (identifier) {
    // Get first letter of identifier
    return identifier.charAt(0).toUpperCase();
  }
  // Default for anonymous users
  return '?';
}
