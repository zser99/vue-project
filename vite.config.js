import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 페이지(zser99.github.io/vue-project/)로 배포되므로 루트가 아닌 서브패스.
  // 로컬 dev/build 는 영향 없음 — router/텍스처 로더가 이미 BASE_URL 기준으로 경로를 만든다.
  base: '/vue-project/',
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
