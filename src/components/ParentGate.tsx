import { ArrowLeft, KeyRound, Lock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { PinResult } from '../lib/pin'
import { useAuth } from '../state/auth'
import { useLock } from '../state/lock'
import { PinInput } from './PinInput'
import { Button } from './ui'

/** Shows the parent portal only after the parent PIN has been entered on this device. */
export function ParentGate({ children }: { children: ReactNode }) {
  const { hasPin, unlocked } = useLock()
  const [forgot, setForgot] = useState(false)

  if (hasPin === null) return null
  if (hasPin && unlocked) return <>{children}</>

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="rise w-full max-w-sm text-center">
        {!hasPin ? <CreatePin /> : forgot ? <ResetPin onBack={() => setForgot(false)} /> : <EnterPin onForgot={() => setForgot(true)} />}
        <Link to="/" className="mt-8 flex items-center justify-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to student view
        </Link>
      </div>
    </div>
  )
}

function Heading({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <>
      <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">{icon}</div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mx-auto mt-2 mb-7 max-w-xs text-sm text-muted">{children}</p>
    </>
  )
}

function EnterPin({ onForgot }: { onForgot(): void }) {
  const { unlock } = useLock()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(value: string) {
    setPin(value)
    setError(null)
    if (value.length < 4) return
    setBusy(true)
    try {
      const result = await unlock(value)
      if (result !== 'ok') {
        setError(result === 'locked' ? 'Too many wrong tries. Wait 5 minutes and try again.' : "That PIN isn't right.")
        setPin('')
      }
    } catch (cause) {
      console.error(cause)
      setError("Couldn't check the PIN. Check your connection and try again.")
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Heading icon={<Lock className="size-5" />} title="Parent portal">
        Enter your 4-digit parent PIN to continue.
      </Heading>
      <PinInput label="Parent PIN" value={pin} onChange={(value) => void handleChange(value)} disabled={busy} invalid={error !== null} autoFocus />
      <p className="mt-4 min-h-5 text-sm text-danger" role="alert">{error}</p>
      <button type="button" onClick={onForgot} className="mx-auto mt-2 block text-sm font-medium text-accent-ink hover:underline">
        Forgot your PIN?
      </button>
    </>
  )
}

function CreatePin() {
  const { setPin } = useLock()
  return (
    <>
      <Heading icon={<KeyRound className="size-5" />} title="Create a parent PIN">
        Students share this account, so the parent portal is locked with a PIN only you know.
      </Heading>
      <NewPinSteps onSave={(pin) => setPin(pin)} />
    </>
  )
}

function ResetPin({ onBack }: { onBack(): void }) {
  const { setPin } = useLock()
  const { demo, signOut } = useAuth()
  const [needsSignIn, setNeedsSignIn] = useState(false)

  if (needsSignIn) {
    return (
      <>
        <Heading icon={<KeyRound className="size-5" />} title="Sign in again first">
          To prove it's you, sign out and sign back in with your password. You then have 10 minutes to come back here and set a new PIN.
        </Heading>
        <div className="flex justify-center gap-2">
          <Button variant="ghost" onClick={onBack}>Cancel</Button>
          <Button variant="primary" onClick={() => void signOut()}>Sign out</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Heading icon={<KeyRound className="size-5" />} title="Set a new PIN">
        {demo ? 'Demo mode lets you replace the PIN freely.' : 'This works if you signed in with your password in the last 10 minutes.'}
      </Heading>
      <NewPinSteps
        onSave={async (pin) => {
          const result = await setPin(pin)
          if (result !== 'ok') setNeedsSignIn(true)
          return result
        }}
      />
      <button type="button" onClick={onBack} className="mt-4 block w-full text-sm font-medium text-muted hover:text-ink">
        I remember it
      </button>
    </>
  )
}

/** Type a new PIN, then type it again to confirm. */
export function NewPinSteps({ onSave }: { onSave(pin: string): Promise<PinResult> }) {
  const [first, setFirst] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(value: string) {
    setPin(value)
    setError(null)
    if (value.length < 4) return
    if (first === null) {
      setFirst(value)
      setPin('')
      return
    }
    if (value !== first) {
      setError("Those didn't match. Start again.")
      setFirst(null)
      setPin('')
      return
    }
    setBusy(true)
    try {
      await onSave(value)
    } catch (cause) {
      console.error(cause)
      setError("Couldn't save the PIN. Please try again.")
      setFirst(null)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="mb-3 text-[13px] font-medium">{first === null ? 'Choose 4 digits' : 'Type it once more'}</p>
      {/* The key remounts the input between steps so focus and state start clean. */}
      <PinInput key={first === null ? 'new' : 'confirm'} label={first === null ? 'New PIN' : 'Confirm new PIN'} value={pin} onChange={(value) => void handleChange(value)} disabled={busy} invalid={error !== null} autoFocus />
      <p className="mt-4 min-h-5 text-sm text-danger" role="alert">{error}</p>
    </>
  )
}
