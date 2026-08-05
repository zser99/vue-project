<script setup>
defineProps({
  progress: { type: Number, default: 0 }, // 0 ~ 1
})
</script>

<template>
  <div class="loading-overlay">
    <div class="content">
      <p class="title">지구를 불러오는 중</p>
      <div class="bar">
        <div class="fill" :style="{ width: `${Math.round(progress * 100)}%` }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, #10182a 0%, #02030a 75%);
}

.content {
  text-align: center;
  color: #f5f5f7;
}

.title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.4px;
  opacity: 0.8;
  margin-bottom: 16px;
}

.bar {
  width: 200px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.85);
  transition: width 0.3s ease;
}
</style>
