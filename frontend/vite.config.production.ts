/// <reference types="vitest" />
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"
import resolve from "vite-plugin-resolve"
import fs from 'fs'

// Function to recursively map directories for alias resolution
function mapDirectoryToAliases(directory: string, baseDirectory: string = '') {
  const aliases: Record<string, string> = {}
  const fullPath = path.join(baseDirectory, directory)
  
  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true })
    
    entries.forEach(entry => {
      if (entry.isDirectory()) {
        const subDirPath = path.join(directory, entry.name)
        const aliasKey = `@/${subDirPath}`
        const aliasValue = path.resolve(baseDirectory, subDirPath)
        
        aliases[aliasKey] = aliasValue
        
        // Recursively map subdirectories
        Object.assign(aliases, mapDirectoryToAliases(subDirPath, baseDirectory))
      }
    })
  } catch (err) {
    console.error(`Error reading directory ${fullPath}:`, err)
  }
  
  return aliases
}

export default defineConfig({
  plugins: [
    tsconfigPaths({ 
      projects: ['tsconfig.build.json']
    }),
    resolve({
      // Base path alias
      "@": path.resolve(__dirname, "src"),
      // We dynamically load all subdirectories to ensure all paths are mapped
      ...mapDirectoryToAliases('src'),
    }),
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Ensures TypeScript files are processed correctly
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  }
}) 