export const getFaviconUrl = (url: string, size = 64) => {
  let hostname = url;
  if (!hostname.startsWith('http://') && !hostname.startsWith('https://')) {
    hostname = 'https://' + hostname;
  }

  try {
    const urlObj = new URL(url);
    hostname = 'https://' + urlObj.hostname;
  } catch {
    // empty
  }

  return `https://favicon.vemetric.com/${hostname}?size=${size}`;
};
