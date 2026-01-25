export const getFaviconUrl = (url: string, size = 64) => {
  let hostname = url;

  try {
    const urlObj = new URL(url);
    hostname = urlObj.hostname;
  } catch {
    // empty
  }

  return `https://favicon.vemetric.com/${hostname}?size=${size}`;
};
