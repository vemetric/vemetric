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

  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=${size}&url=${hostname}`;
};
