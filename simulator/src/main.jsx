import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import USISimulator from './USISimulator.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <USISimulator />
  </StrictMode>,
)
