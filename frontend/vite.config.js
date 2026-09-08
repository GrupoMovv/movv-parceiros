import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const ICON_SIZES = [72, 96, 128, 144, 192, 384, 512];

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest (não generateSW) porque o service worker precisa de
      // handlers próprios de push/notificationclick (ver src/sw.js) — o
      // modo automático generateSW não permite código customizado no SW.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      manifestFilename: 'manifest.json',
      injectRegister: false, // registro explícito em main.jsx via virtual:pwa-register
      registerType: 'autoUpdate',
      includeAssets: ['iub-favicon.png', 'apple-touch-icon.png'],
      injectManifest: {
        // bundle principal do app fica perto de 2MB — sobe o teto padrão
        // do workbox (2MB) pra não deixar o maior chunk de fora do precache.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: {
        enabled: true, // dá pra testar instalação/offline já em `npm run dev`
        type: 'module',
      },
      manifest: {
        name: 'IUB MAIS - Marketplace de Itumbiara',
        short_name: 'IUB MAIS',
        description: 'Marketplace de Itumbiara - Produtos e serviços locais com preços especiais pra associados SECI',
        start_url: '/marketplace',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#4C1D95',
        theme_color: '#4C1D95',
        lang: 'pt-BR',
        categories: ['shopping', 'business', 'lifestyle'],
        icons: [
          ...ICON_SIZES.map(size => ({
            src: `/icons/icon-${size}x${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
            purpose: 'any',
          })),
          {
            src: '/icons/icon-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/home.png',
            sizes: '1080x1920',
            type: 'image/png',
            form_factor: 'narrow',
          },
        ],
        shortcuts: [
          {
            name: 'Ofertas do Dia',
            url: '/marketplace#ofertas',
            icons: [{ src: '/icons/shortcut-ofertas.png', sizes: '96x96' }],
          },
          {
            name: 'Meu Carrinho',
            url: '/marketplace/carrinho',
            icons: [{ src: '/icons/shortcut-carrinho.png', sizes: '96x96' }],
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
