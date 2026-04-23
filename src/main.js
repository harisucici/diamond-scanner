import { createApp } from 'vue'
import App from './App.vue'
import NecklaceSales from './pages/NecklaceSales.vue'

const app = createApp(App)

// 注册组件
app.component('NecklaceSales', NecklaceSales)

app.mount('#app')
