import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../services/api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) { setError('Invalid reset link. Please request a new one.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid or expired reset link. Please request a new one.')
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
        <h2 className="login-title">Set New Password</h2>
        <p className="login-subtitle">Choose a strong password for your admin account</p>

        {done ? (
          <div className="modal-form">
            <p style={{ color: '#aef0c0', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
              Password updated successfully!
            </p>
            <button className="btn-submit" style={{ marginTop: 8 }} onClick={() => navigate('/')}>
              Sign In
            </button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            {!token && (
              <p className="modal-error">Missing reset token. Please use the link from the reset page.</p>
            )}

            <div className="modal-field">
              <label htmlFor="password">New Password</label>
              <input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="modal-field">
              <label htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                type="password"
                placeholder="Repeat your new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="modal-error">{error}</p>}

            <button className="btn-submit" type="submit" disabled={loading || !token}>
              {loading ? 'Saving…' : 'Set Password'}
            </button>
          </form>
        )}

        {!done && (
          <p className="modal-footer">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', padding: 0 }}
            >
              ← Request a new link
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
