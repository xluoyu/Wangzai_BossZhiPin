import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 纯前端 demo：不引入后端、不配置 proxy、不连接 Tauri。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
})
