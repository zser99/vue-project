<script setup>
// 부모로부터 현재 검색어를 props로 받는다
defineProps({
  searchQuery: {
    type: String,
    default: '',
  },
})

// 입력값이 바뀌면 부모에게 새 검색어를 알려준다 (update-query emit)
const emit = defineEmits(['update-query'])
</script>

<template>
  <input
    type="text"
    class="search-input"
    :value="searchQuery"
    @input="emit('update-query', $event.target.value)"
    placeholder="검색할 도시 입력하세요."
  />
</template>

<style scoped>
.search-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  /* --color-border 는 이 프로젝트 토큰에 없어서(테마엔 --glass-border) 무효 값이 되어
     테두리가 안 보이던 것 — 실제 토큰으로 교체하고, 어두운 배경에서 읽히도록 배경/글자색도 추가 */
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 15px;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-input:focus {
  outline: none;
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
}
</style>
