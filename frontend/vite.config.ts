import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function asyncCssLinkPlugin() {
  return {
    name: 'async-css-link',
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g,
        `<link rel="stylesheet" crossorigin href="$1" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" crossorigin href="$1"></noscript>`
      );
    }
  };
}

export default defineConfig(({ mode }) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cwd = (globalThis as { process?: { cwd: () => string } }).process?.cwd?.() ?? '.';
  const env = loadEnv(mode, cwd, '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';

  return {
    plugins: [react(), asyncCssLinkPlugin()],
    test: {
      environment: 'node',
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/__dev/personality-studio-api': {
          target: 'http://127.0.0.1:5174',
          changeOrigin: false,
          secure: false,
        },
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
            });
          }
        }
      }
    }
  };
});
