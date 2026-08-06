import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useProject } from './store/project'
import { applyTheme, loadTheme } from './lib/theme'
import { AppDialogProvider } from './components/dialogs/AppDialogProvider'

// データ復元中にもテーマがちらつかないよう、描画前に適用する
applyTheme(loadTheme())

// IndexedDB からの復元を待ってから描画する（一瞬空のプロジェクトが見えるのを防ぐ）
await useProject.getState().init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDialogProvider>
      <App />
    </AppDialogProvider>
  </StrictMode>,
)
