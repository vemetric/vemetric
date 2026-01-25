const regexes = {
  ipv4: /^(?:(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])$/,
  ipv6: /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i,
};

const isValidIp = (value?: string | null) => {
  if (!value) {
    return false;
  }

  return regexes.ipv4.test(value) || regexes.ipv6.test(value);
};

function getClientIpFromXForwardedFor(value: string | null) {
  if (!value) {
    return null;
  }

  const forwardedIps = value.split(',').map((entry) => {
    const ip = entry.trim();
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length === 2) {
        return parts[0];
      }
    }
    return ip;
  });

  for (let i = 0; i < forwardedIps.length; i++) {
    if (isValidIp(forwardedIps[i])) {
      return forwardedIps[i];
    }
  }

  return null;
}

export function getClientIpFromHeaders(headers: Headers): string | null {
  const directHeader = headers.get('x-client-ip');
  if (isValidIp(directHeader)) {
    return directHeader;
  }

  const xForwardedFor = getClientIpFromXForwardedFor(headers.get('x-forwarded-for'));
  if (isValidIp(xForwardedFor)) {
    return xForwardedFor;
  }

  const cfConnecting = headers.get('cf-connecting-ip');
  if (isValidIp(cfConnecting)) {
    return cfConnecting;
  }

  const doConnecting = headers.get('do-connecting-ip');
  if (isValidIp(doConnecting)) {
    return doConnecting;
  }

  const fastly = headers.get('fastly-client-ip');
  if (isValidIp(fastly)) {
    return fastly;
  }

  const trueClient = headers.get('true-client-ip');
  if (isValidIp(trueClient)) {
    return trueClient;
  }

  const xRealIp = headers.get('x-real-ip');
  if (isValidIp(xRealIp)) {
    return xRealIp;
  }

  const xClusterClientIp = headers.get('x-cluster-client-ip');
  if (isValidIp(xClusterClientIp)) {
    return xClusterClientIp;
  }

  const xForwarded = headers.get('x-forwarded');
  if (isValidIp(xForwarded)) {
    return xForwarded;
  }

  const forwardedFor = headers.get('forwarded-for');
  if (isValidIp(forwardedFor)) {
    return forwardedFor;
  }

  const forwarded = headers.get('forwarded');
  if (isValidIp(forwarded)) {
    return forwarded;
  }

  const appEngine = headers.get('x-appengine-user-ip');
  if (isValidIp(appEngine)) {
    return appEngine;
  }

  const cfPseudo = headers.get('cf-pseudo-ipv4');
  if (isValidIp(cfPseudo)) {
    return cfPseudo;
  }

  return null;
}
