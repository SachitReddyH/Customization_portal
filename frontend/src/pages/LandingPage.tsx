import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    // TODO: Replace with real API call → POST /auth/login
    await new Promise(r => setTimeout(r, 600))
    setLoading(false)
    navigate('/hub')
  }

  return (
    <div className="landing-split">

      {/* ── LEFT — Villa image + heading ── */}
      <div className="landing-left">
        {/*
          ── SWAP HERO IMAGE HERE ──────────────────────
          Change background-image in .landing-left in index.css
          e.g. backgroundImage: "url('/your-hero.jpg')"
        */}
        <div className="landing-left-overlay" />

        {/* Navbar sits inside left panel */}
        <nav className={`navbar-split ${scrolled ? 'scrolled' : ''}`}>
          <div className="navbar-logo">
            <span className="navbar-logo-text">CAPSTONE LIFE</span>
            <span className="navbar-logo-dot" />
          </div>
        </nav>

        <div className="landing-hero-content">
          <h1 className="hero-heading">
            Customize Your Villa, <br />Crafted to Your Vision.
          </h1>
        </div>
      </div>

      {/* ── RIGHT — Login form ── */}
      <div className="landing-right">
        <div className="login-panel">
          <h2 className="login-title">Login</h2>
          <p className="login-subtitle">Sign in to start customising your villa</p>

          <form className="modal-form" onSubmit={handleLogin}>
            <div className="modal-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="modal-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <p className="modal-error">{error}</p>}

            <button className="btn-submit" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="modal-footer">
            Don't have an account?{' '}
            <a href="mailto:info@capstonelife.in">Contact us</a>
          </p>
        </div>
      </div>

    </div>
  )
}
