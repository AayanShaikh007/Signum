import React from 'react'
import ReactDOM from 'react-dom/client'
const App = import.meta.env.VITE_PUBLIC_DEMO === 'true'
  ? React.lazy(() => import('./DemoApp'))
  : React.lazy(() => import('./App'))
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={<p className="source-note">Loading Signum…</p>}><App/></React.Suspense></React.StrictMode>)
