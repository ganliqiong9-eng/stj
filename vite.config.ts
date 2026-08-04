import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === 'build' ? [VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'STJ 学习助手',
        short_name: 'STJ',
        description: '个人知识管理 + 刷题学习工具',
        theme_color: '#3370ff',
        background_color: '#f7f8fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 86400 } }
          },
          {
            urlPattern: /^http:\/\/localhost:8086\/api\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 3, expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
          }
        ]
      }
    })] : []),
  ],
  server: {
    // 允许手机通过 Tailscale MagicDNS / LAN 主机名访问，否则 Vite 会 403 拦截
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'mac-mini',
      'mac-mini.local',
      '.tail01ecce.ts.net',
      '.local',
    ],
    watch: {
      // 后端运行时会写这些数据文件，避免 Vite 监听它们触发整页刷新
      ignored: [
        '**/data.json',
        '**/knowledge.json',
        '**/embeddings.json',
        '**/rag_config.json',
        '**/table_meta.json',
        '**/knowledge_points.json',
        '**/questions.json',
        '**/table_folders.json',
        '**/compiler.db',
        '**/.tmp_rag_*',
        '**/.tmp_sql_*',
      ],
    },
  },
}))
