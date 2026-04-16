import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/api'

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // No auto-redirect — always show the login form so the browser back button works naturally

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      const data = await login(email, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user_role', data.role)
      localStorage.setItem('user_name', data.full_name)
      navigate(data.role === 'admin' ? '/admin' : '/hub')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
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
            <img src="/capstonelife-logo.svg" alt="Capstone Life" className="navbar-logo-img" />
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
