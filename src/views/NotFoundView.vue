<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="not-found">
    <div class="glass-panel card">
      <p class="code">404</p>
      <h2>페이지를 찾을 수 없어요</h2>
      <p class="desc">주소가 잘못되었거나 삭제된 페이지입니다.</p>
      <RouterLink to="/" class="glass-pill">지구본으로 돌아가기</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-space);
}

.card {
  text-align: center;
  padding: 48px 56px;
}

.code {
  font-size: 56px;
  font-weight: 200;
  letter-spacing: 4px;
  color: var(--text-tertiary);
}

.card h2 {
  font-weight: 600;
  margin: 8px 0 4px;
}

.desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 24px;
}
</style>
