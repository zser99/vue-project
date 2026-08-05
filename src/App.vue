<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import UnitToggler from './components/weather/UnitToggler.vue'

const route = useRoute()
// 지구본 홈과 404 는 자체 풀스크린 레이아웃을 가지므로 공용 헤더를 숨긴다
const showChrome = computed(() => !['globe', 'not-found'].includes(route.name))
</script>

<template>
  <div class="app-shell" :class="{ 'with-chrome': showChrome }">
    <!-- Navigation Bar: UnitToggler 를 여기 두면 목록/상세 페이지 모두에 자동 적용된다 -->
    <header v-if="showChrome" class="app-header">
      <div class="left">
        <RouterLink to="/list" class="logo">오늘의 날씨</RouterLink>
        <RouterLink to="/" class="glass-pill">🌍 지구본</RouterLink>
      </div>
      <UnitToggler />
    </header>

    <main :class="showChrome ? 'app-content' : 'app-full'">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.app-shell.with-chrome {
  min-height: 100vh;
  background: var(--bg-space);
  /* 새 스태킹 컨텍스트를 만들어야 자식의 position:fixed + z-index:-1 배경이
     (같은 컨텍스트에서 일반 블록보다 아래 그려지는) 이 배경 위로 올라온다 */
  isolation: isolate;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: rgba(10, 14, 26, 0.55);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border-bottom: 1px solid var(--glass-border);
}

.left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo {
  font-weight: 600;
  font-size: 18px;
  letter-spacing: 0.3px;
  text-decoration: none;
  color: var(--text-primary);
}

.app-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}

.app-full {
  /* 지구본 등 풀스크린 뷰: 여백 없이 화면 전체 사용 */
  width: 100%;
}

/* 페이지 전환 트랜지션 — 공백이 느껴지지 않게 짧고 미묘하게 */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
