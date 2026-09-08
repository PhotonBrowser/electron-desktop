import { resolve } from "node:path"
import { defineConfig } from "electron-vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const aliases = [
  { find: "@resources", replacement: resolve("resources") },
  { find: "@", replacement: resolve("src") },
]

export default defineConfig({
  main: {
    resolve: { alias: aliases },
  },
  preload: {
    resolve: { alias: aliases },
  },
  renderer: {
    resolve: {
      alias: aliases,
    },
    plugins: [react(), tailwindcss()],
  },
})
