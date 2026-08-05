import { createRouter, createWebHistory } from 'vue-router'

// 모든 라우트를 지연 로딩(dynamic import)으로 분리 — 특히 three.js 가 포함된
// 지구본 홈 청크가 목록/상세 페이지 방문자에게 미리 로드되지 않도록 한다
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'globe', component: () => import('@/views/GlobeView.vue') },
    { path: '/list', name: 'weather-list', component: () => import('@/views/WeatherListView.vue') },
    {
      path: '/city/:cityId',
      name: 'weather-detail',
      component: () => import('@/views/WeatherDetailView.vue'),
    },
    // Catch-all: 존재하지 않는 경로는 404 안내 페이지로
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

export default router
