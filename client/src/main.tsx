import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { trackViewportHeight } from './utils/viewportHeight'

// Keeps --app-height in sync with the visible viewport so the iOS keyboard
// can't cover the composer. Lives outside React: it's a document-level concern
// and must be running before first paint.
trackViewportHeight()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
