/**
 * Without `defaultImage`, domains without a favicon get the service's grey globe. `'none'` makes the image fail to load
 * instead, so `onError` can show an own placeholder.
 */
export const getFaviconUrl = (url: string, size = 64, { defaultImage }: { defaultImage?: 'none' } = {}) => {
  let hostname = url;

  try {
    const urlObj = new URL(url);
    hostname = urlObj.hostname;
  } catch {
    // empty
  }

  return `https://favicon.vemetric.com/${hostname}?size=${size}${defaultImage ? `&default=${defaultImage}` : ''}`;
};
