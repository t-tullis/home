import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Button, Card, Field, Input } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../state/auth'

export default function Login() {
  const { signedIn, loading } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!loading && signedIn) return <Navigate to="/parent" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const credentials = { email: email.trim(), password }
    const { data, error: authError } =
      mode === 'signin' ? await supabase.auth.signInWithPassword(credentials) : await supabase.auth.signUp(credentials)
    if (authError) setError(authError.message)
    else if (mode === 'signup' && !data.session) setNotice('Check your email for a link to confirm your account.')
    setBusy(false)
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="rise w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-semibold tracking-tight">{mode === 'signin' ? 'Welcome back' : 'Create your family account'}</h1>
          <p className="mt-1 mb-5 text-sm text-muted">
            {mode === 'signin' ? 'Sign in to your family account.' : 'One account for the whole family. You add students after signing up.'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            {notice && <p className="rounded-xl bg-success-soft px-3 py-2 text-sm text-success">{notice}</p>}
            <Button variant="primary" type="submit" className="w-full" disabled={busy}>
              {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
        </Card>
        <p className="mt-5 text-center text-sm text-muted">
          {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
          <button type="button" className="font-medium text-accent-ink hover:underline" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
