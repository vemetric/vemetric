import { getDevProxyPort, getDevProxyPortExtension } from '@vemetric/common/env';
import { serve, type ServerWebSocket } from 'bun';
import { Hono } from 'hono';
import { logger } from './logger';

if (process.env.VEMETRIC_DEV_PROXY_DISABLED === 'true') {
  logger.info('Vemetric Dev Proxy is disabled');
  process.exit(0);
}

const PORT = getDevProxyPort();
const PORT_EXTENSION = getDevProxyPortExtension();
const app = new Hono();

interface ProxyConfig {
  host: string;
  target: string;
}

interface WebSocketData {
  host: string;
  proxyConfig: ProxyConfig;
  path: string;
  targetWs?: WebSocket;
}

const proxies: ProxyConfig[] = [
  {
    host: `vemetric.localhost${PORT_EXTENSION}`,
    target: 'http://localhost:4001',
  },
  {
    host: `app.vemetric.localhost${PORT_EXTENSION}`,
    target: 'http://localhost:4000',
  },
  {
    host: `hub.vemetric.localhost${PORT_EXTENSION}`,
    target: 'http://localhost:4004',
  },
  {
    host: `bullboard.vemetric.localhost${PORT_EXTENSION}`,
    target: 'http://localhost:4121',
  },
];

app.all('*', async (c) => {
  const requestHost = c.req.header('host');
  const proxyConfig = proxies.find((p) => p.host === requestHost);

  if (!proxyConfig) {
    return c.text(`Unknown host: ${requestHost}`, 404);
  }

  const url = new URL(c.req.url);
  const targetUrl = `${proxyConfig.target}${url.pathname}${url.search}`;

  // Copy headers but replace the Host header
  const headers = new Headers(c.req.raw.headers);
  headers.set('host', new URL(proxyConfig.target).host);

  try {
    // Simply pass everything through
    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.raw.blob() : undefined,
      redirect: 'manual',
    });

    // Return response as-is
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error: any) {
    const errorMessage = `Service unavailable: ${proxyConfig.target}`;

    if (error?.code === 'ConnectionRefused' || error?.code === 'ECONNREFUSED') {
      logger.warn(`[${new Date().toISOString()}] ${requestHost} -> ${proxyConfig.target} (service not running)`);
    } else if (error?.code === 'ECONNRESET' || error?.message?.includes('socket connection was closed')) {
      logger.info(
        `[${new Date().toISOString()}] ${requestHost} -> ${proxyConfig.target} (connection reset, likely restarting)`,
      );
    } else {
      logger.error(
        { error: error?.message || error },
        `[${new Date().toISOString()}] Proxy error for ${requestHost} -> ${proxyConfig.target}:`,
      );
    }

    return c.text(errorMessage, 503);
  }
});

serve({
  fetch(req, server) {
    const url = new URL(req.url);
    const requestHost = req.headers.get('host');
    const proxyConfig = proxies.find((p) => p.host === requestHost);

    if (req.headers.get('upgrade') === 'websocket' && proxyConfig) {
      const success = server.upgrade(req, {
        data: {
          host: requestHost,
          proxyConfig: proxyConfig,
          path: `${url.pathname}${url.search}`,
        } as WebSocketData,
      });

      if (success) {
        return undefined as any;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    return app.fetch(req, server);
  },
  port: PORT,
  hostname: '0.0.0.0',
  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      const { host, proxyConfig, path } = ws.data;
      const wsTarget = `${proxyConfig.target.replace('http://', 'ws://')}${path}`;

      const targetWs = new WebSocket(wsTarget);

      targetWs.onopen = () => {
        logger.info(`[${new Date().toISOString()}] WebSocket connected: ${host} -> ${wsTarget}`);
      };

      targetWs.onmessage = (event) => ws.send(event.data);
      targetWs.onclose = () => ws.close();
      targetWs.onerror = () => ws.close();

      ws.data.targetWs = targetWs;
    },
    message(ws: ServerWebSocket<WebSocketData>, message) {
      ws.data.targetWs?.send(message);
    },
    close(ws: ServerWebSocket<WebSocketData>) {
      ws.data.targetWs?.close();
    },
  },
});

logger.info(`\n🚀 Dev proxy server running on port ${PORT}`);
logger.info('📍 Available routes:');
proxies.forEach(({ host, target }) => {
  logger.info(`   http://${host} → ${target}`);
});
logger.info('');
