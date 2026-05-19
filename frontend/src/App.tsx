import { useState, useEffect, useRef } from 'react'
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
import CRMLayout from './pages/crm/CRMLayout'
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
        </Route>
        <Route path="/crm" element={<CRMLayout />}>
          <Route index element={<Navigate to="/crm/customers" replace />} />
          <Route path="customers" element={<CRMCustomers />} />
          <Route path="quotes" element={<CRMQuotes />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
