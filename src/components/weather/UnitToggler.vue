<script setup>
import { useConfigStore } from '@/stores/configStore'

const configStore = useConfigStore()
</script>

<template>
  <!-- iOS 세그먼트 스타일 온도 단위 전환 — 지구본/목록/상세 공용 -->
  <div class="segmented" :class="{ 'is-f': configStore.unit === 'F' }">
    <div class="thumb"></div>
    <button
      type="button"
      :class="{ active: configStore.unit === 'C' }"
      @click="configStore.unit = 'C'"
    >
      ℃
    </button>
    <button
      type="button"
      :class="{ active: configStore.unit === 'F' }"
      @click="configStore.unit = 'F'"
    >
      ℉
    </button>
  </div>
</template>

<style scoped>
.segmented {
  position: relative;
  display: inline-flex;
  width: 96px;
  height: 34px;
  padding: 3px;
  border-radius: 18px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
}

.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.9);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.segmented.is-f .thumb {
  transform: translateX(100%);
}

.segmented button {
  position: relative;
  z-index: 1;
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: color 0.25s ease;
}

.segmented button.active {
  color: #1c1c1e;
}
</style>
