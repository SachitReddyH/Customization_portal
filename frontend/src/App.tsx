import { useState, useEffect, useRef, Component } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CustomisationHub from './pages/CustomisationHub'
import CategoryPage from './pages/CategoryPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCustomers from './pages/admin/AdminCustomers'
import AdminCustomerDetail from './pages/admin/AdminCustomerDetail'
import AdminQuotes from './pages/admin/AdminQuotes'
import AdminOptions from './pages/admin/AdminOptions'
import AdminDrawingRegister from './pages/admin/AdminDrawingRegister'
import AdminSpaceCust from './pages/admin/AdminSpaceCust'
import AdminStaff from './pages/admin/AdminStaff'
import CRMLayout from './pages/crm/CRMLayout'
import DesignLayout from './pages/design/DesignLayout'
import CRMCustomers from './pages/crm/CRMCustomers'
import CRMQuotes from './pages/crm/CRMQuotes'
import './index.css'

// Module-level blob cache — survives all navigations for the session
let _cachedVideoSrc: string | null = null

function AppContent() {
  const location = useLocation()
  const isHub = location.pathname === '/hub'

  const [videoSrc, setVideoSrc] = useState<string>(_cachedVideoSrc ?? '/villa_banner.mp4')
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Start fetching the blob as early as possible (app load, not hub mount)
  useEffect(() => {
    if (_cachedVideoSrc) return
    fetch('/villa_banner.mp4')
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        _cachedVideoSrc = url
        setVideoSrc(url)
      })
      .catch(() => {})
  }, [])

  // Show video on hub, hide on other pages
  useEffect(() => {
    if (!isHub) { setVideoReady(false); return }
    const video = videoRef.current
    if (!video) { setVideoReady(true); return }
    video.currentTime = 0
    // canplay fires as soon as browser can start playing
    if (video.readyState >= 2) { setVideoReady(true); return }
    const onReady = () => setVideoReady(true)
    video.addEventListener('canplay', onReady, { once: true })
    return () => video.removeEventListener('canplay', onReady)
  }, [isHub])

  return (
    <>
      {/* Persistent video — always mounted so the decoder never restarts */}
      <video
        ref={videoRef}
        className={`app-bg-video ${videoReady ? 'app-bg-video--visible' : ''}`}
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/hub" element={<CustomisationHub />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:customerId" element={<AdminCustomerDetail />} />
          <Route path="quotes" element={<AdminQuotes />} />
          <Route path="options" element={<AdminOptions />} />
          <Route path="drawing" element={<AdminDrawingRegister />} />
          <Route path="space-cust" element={<AdminSpaceCust />} />
          <Route path="staff" element={<AdminStaff />} />
        </Route>
        <Route path="/crm" element={<CRMLayout />}>
          <Route index element={<Navigate to="/crm/customers" replace />} />
          <Route path="customers" element={<CRMCustomers />} />
          <Route path="quotes" element={<CRMQuotes />} />
        </Route>
        <Route path="/design" element={<DesignLayout />}>
          <Route index element={<Navigate to="/design/drawing" replace />} />
          <Route path="drawing" element={<AdminDrawingRegister />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  constructor(props: any) { super(props); this.state = { error: '' } }
  static getDerivedStateFromError(e: any) { return { error: String(e) } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: '#c00', whiteSpace: 'pre-wrap' }}>
        <b>App crash — please share this with the developer:</b>{'\n\n'}{this.state.error}
      </div>
    )
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
