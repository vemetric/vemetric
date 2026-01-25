import type { Context } from 'hono';
import { getConnInfo } from 'hono/bun';

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

/**
 * Parse x-forwarded-for headers.
 *
 * @param {string} value - The value to be parsed.
 * @return {string|null} First known IP address, if any.
 */
function getClientIpFromXForwardedFor(value: string | undefined) {
  if (!value) {
    return null;
  }

  // x-forwarded-for may return multiple IP addresses in the format:
  // "client IP, proxy 1 IP, proxy 2 IP"
  // Therefore, the right-most IP address is the IP address of the most recent proxy
  // and the left-most IP address is the IP address of the originating client.
  // source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
  // Azure Web App's also adds a port for some reason, so we'll only use the first part (the IP)
  const forwardedIps = value.split(',').map((e) => {
    const ip = e.trim();
    if (ip.includes(':')) {
      const splitted = ip.split(':');
      // make sure we only use this if it's ipv4 (ip:port)
      if (splitted.length === 2) {
        return splitted[0];
      }
    }
    return ip;
  });

  // Sometimes IP addresses in this header can be 'unknown' (http://stackoverflow.com/a/11285650).
  // Therefore taking the right-most IP address that is not unknown
  // A Squid configuration directive can also set the value to "unknown" (http://www.squid-cache.org/Doc/config/forwarded_for/)
  for (let i = 0; i < forwardedIps.length; i++) {
    if (isValidIp(forwardedIps[i])) {
      return forwardedIps[i];
    }
  }

  // If no value in the split list is an ip, return null
  return null;
}

/**
 * Determine client IP address.
 *
 * @param req
 * @returns {string} ip - The IP address if known, defaulting to empty string if unknown.
 */
export function getClientIp(context: Context) {
  const { req } = context;

  // Standard headers used by Amazon EC2, Heroku, and others.
  if (isValidIp(req.header('x-client-ip'))) {
    return req.header('x-client-ip');
  }

  // Load-balancers (AWS ELB) or proxies.
  const xForwardedFor = getClientIpFromXForwardedFor(req.header('x-forwarded-for'));
  if (isValidIp(xForwardedFor)) {
    return xForwardedFor;
  }

  // Cloudflare.
  // @see https://support.cloudflare.com/hc/en-us/articles/200170986-How-does-Cloudflare-handle-HTTP-Request-headers-
  // CF-Connecting-IP - applied to every request to the origin.
  if (isValidIp(req.header('cf-connecting-ip'))) {
    return req.header('cf-connecting-ip');
  }

  // DigitalOcean.
  // @see https://www.digitalocean.com/community/questions/app-platform-client-ip
  // DO-Connecting-IP - applied to app platform servers behind a proxy.
  if (isValidIp(req.header('do-connecting-ip'))) {
    return req.header('do-connecting-ip');
  }

  // Fastly and Firebase hosting header (When forwared to cloud function)
  if (isValidIp(req.header('fastly-client-ip'))) {
    return req.header('fastly-client-ip');
  }

  // Akamai and Cloudflare: True-Client-IP.
  if (isValidIp(req.header('true-client-ip'))) {
    return req.header('true-client-ip');
  }

  // Default nginx proxy/fcgi; alternative to x-forwarded-for, used by some proxies.
  if (isValidIp(req.header('x-real-ip'))) {
    return req.header('x-real-ip');
  }

  // (Rackspace LB and Riverbed's Stingray)
  // http://www.rackspace.com/knowledge_center/article/controlling-access-to-linux-cloud-sites-based-on-the-client-ip-address
  // https://splash.riverbed.com/docs/DOC-1926
  if (isValidIp(req.header('x-cluster-client-ip'))) {
    return req.header('x-cluster-client-ip');
  }

  if (isValidIp(req.header('x-forwarded'))) {
    return req.header('x-forwarded');
  }

  if (isValidIp(req.header('forwarded-for'))) {
    return req.header('forwarded-for');
  }

  if (isValidIp(req.header('forwarded'))) {
    return req.header('forwarded');
  }

  // Google Cloud App Engine
  // https://cloud.google.com/appengine/docs/standard/go/reference/request-response-headers
  if (isValidIp(req.header('x-appengine-user-ip'))) {
    return req.header('x-appengine-user-ip');
  }

  try {
    const remoteAddress = getConnInfo(context).remote.address ?? '';
    if (isValidIp(remoteAddress)) {
      return remoteAddress;
    }
  } catch {
    /* empty */
  }

  // Cloudflare fallback
  // https://blog.cloudflare.com/eliminating-the-last-reasons-to-not-enable-ipv6/#introducingpseudoipv4
  if (isValidIp(req.header('Cf-Pseudo-IPv4'))) {
    return req.header('Cf-Pseudo-IPv4');
  }

  return null;
}

/**
 * Determine client IP address from a web Request object.
 *
 * @param request - The web Request object
 * @returns {string | null} ip - The IP address if known, null if unknown.
 */
export function getClientIpFromRequest(request: Request): string | null {
  const headers = request.headers;

  // Standard headers used by Amazon EC2, Heroku, and others.
  if (isValidIp(headers.get('x-client-ip'))) {
    return headers.get('x-client-ip');
  }

  // Load-balancers (AWS ELB) or proxies.
  const xForwardedFor = getClientIpFromXForwardedFor(headers.get('x-forwarded-for') ?? undefined);
  if (isValidIp(xForwardedFor)) {
    return xForwardedFor;
  }

  // Cloudflare.
  if (isValidIp(headers.get('cf-connecting-ip'))) {
    return headers.get('cf-connecting-ip');
  }

  // DigitalOcean.
  if (isValidIp(headers.get('do-connecting-ip'))) {
    return headers.get('do-connecting-ip');
  }

  // Fastly and Firebase hosting header
  if (isValidIp(headers.get('fastly-client-ip'))) {
    return headers.get('fastly-client-ip');
  }

  // Akamai and Cloudflare: True-Client-IP.
  if (isValidIp(headers.get('true-client-ip'))) {
    return headers.get('true-client-ip');
  }

  // Default nginx proxy/fcgi; alternative to x-forwarded-for
  if (isValidIp(headers.get('x-real-ip'))) {
    return headers.get('x-real-ip');
  }

  // Rackspace LB and Riverbed's Stingray
  if (isValidIp(headers.get('x-cluster-client-ip'))) {
    return headers.get('x-cluster-client-ip');
  }

  if (isValidIp(headers.get('x-forwarded'))) {
    return headers.get('x-forwarded');
  }

  if (isValidIp(headers.get('forwarded-for'))) {
    return headers.get('forwarded-for');
  }

  if (isValidIp(headers.get('forwarded'))) {
    return headers.get('forwarded');
  }

  // Google Cloud App Engine
  if (isValidIp(headers.get('x-appengine-user-ip'))) {
    return headers.get('x-appengine-user-ip');
  }

  // Cloudflare fallback
  if (isValidIp(headers.get('Cf-Pseudo-IPv4'))) {
    return headers.get('Cf-Pseudo-IPv4');
  }

  return null;
}
