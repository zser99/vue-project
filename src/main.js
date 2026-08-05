import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Element Plus 스타일 (컴포넌트는 각 뷰에서 개별 import — 트리셰이킹)
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './assets/theme.css'

import App from './App.vue'
import router from './router'

// 앱 전체가 다크 글래스 디자인이므로 Element Plus 도 항상 다크 테마
document.documentElement.classList.add('dark')

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
