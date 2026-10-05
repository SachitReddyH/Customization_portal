import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { forgotPassword } from '../services/api'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetLink, setResetLink] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true)
    try {
      const data = await forgotPassword(email)
      if (data.reset_token) {
        const origin = window.location.origin
        setResetLink(`${origin}/reset-password?token=${data.reset_token}`)
      } else {
        // Email not found or not an admin — show same message to avoid enumeration
        setResetLink('not-found')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-full">
      <div className="landing-full-overlay" />

      <div className="landing-logo">
        <img src="/capstonelife-logo.svg" alt="Capstone Life" className="navbar-logo-img" />
      </div>

      <div className="landing-glass-card">
        <h2 className="login-title">Reset Password</h2>
        <p className="login-subtitle">Enter your admin email to get a reset link</p>

        {!resetLink ? (
          <form className="modal-form" onSubmit={handleSubmit}>
            <div className="modal-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@capstonelife.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {error && <p className="modal-error">{error}</p>}

            <button className="btn-submit" type="submit" disabled={loading}>
              {loading ? 'Generating link…' : 'Get Reset Link'}
            </button>
          </form>
        ) : resetLink === 'not-found' ? (
          <div className="modal-form">
            <p style={{ color: '#ccc', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
              If that email is registered as an admin, a reset link would appear here.
              Please check the email and try again.
            </p>
            <button className="btn-submit" style={{ marginTop: 8 }} onClick={() => setResetLink('')}>
              Try Again
            </button>
          </div>
        ) : (
          <div className="modal-form">
            <p style={{ color: '#ccc', fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
              Your reset link is ready. It expires in <strong style={{ color: '#fff' }}>15 minutes</strong>.
              Click below to set your new password.
            </p>
            <a
              href={resetLink}
              className="btn-submit"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              Set New Password
            </a>
            <p style={{ color: '#aaa', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              Or copy this link:
            </p>
            <input
              readOnly
              value={resetLink}
              onClick={e => (e.target as HTMLInputElement).select()}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 11,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, color: '#ddd', fontFamily: 'monospace', cursor: 'text',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <p className="modal-footer">
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', padding: 0 }}
          >
            ← Back to Sign In
          </button>
        </p>
      </div>
    </div>
  )
}
