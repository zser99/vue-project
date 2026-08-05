<script setup>
import { ref } from 'vue'
import { ElInput, ElButton } from 'element-plus'

const emit = defineEmits(['search'])
const keyword = ref('')

const handleSubmit = () => {
  const cityName = keyword.value.trim()
  if (!cityName) return
  emit('search', cityName)
  keyword.value = ''
}
</script>

<template>
  <div class="search-bar">
    <ElInput
      v-model="keyword"
      size="large"
      clearable
      placeholder="도시 이름을 입력하세요 (예: Seoul)"
      @keyup.enter="handleSubmit"
    >
      <template #append>
        <ElButton @click="handleSubmit">검색</ElButton>
      </template>
    </ElInput>
  </div>
</template>

<style scoped>
.search-bar {
  margin-bottom: 24px;
}

/* Element Plus 입력창을 글래스 필 스타일로 */
.search-bar :deep(.el-input__wrapper) {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 999px 0 0 999px;
  box-shadow: none;
  border: 1px solid var(--glass-border);
  border-right: none;
  padding-left: 20px;
}

.search-bar :deep(.el-input__wrapper.is-focus) {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
}

.search-bar :deep(.el-input-group__append) {
  background: var(--glass-bg);
  border-radius: 0 999px 999px 0;
  box-shadow: none;
  border: 1px solid var(--glass-border);
  border-left: none;
  color: var(--text-primary);
}

.search-bar :deep(.el-input-group__append .el-button) {
  color: var(--text-primary);
  font-weight: 600;
}
</style>
