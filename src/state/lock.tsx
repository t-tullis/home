import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { pinApi, type PinResult } from '../lib/pin'

interface LockState {
  /** null while we're still asking whether a PIN exists. */
  hasPin: boolean | null
  unlocked: boolean
  unlock(pin: string): Promise<PinResult>
  setPin(newPin: string, currentPin?: string): Promise<PinResult>
  lock(): void
}

const LockContext = createContext<LockState | null>(null)

/**
 * Whether the parent portal is open on this device right now. Held in memory
 * only, so a reload, or going back to the student view, locks it again.
 */
export function LockProvider({ children }: { children: ReactNode }) {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    pinApi.hasPin().then(
      (value) => !cancelled && setHasPin(value),
      (cause) => {
        console.error(cause)
        // If we can't tell, ask for a PIN rather than let anyone in.
        if (!cancelled) setHasPin(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const unlock = useCallback(async (pin: string) => {
    const result = await pinApi.verify(pin)
    if (result === 'ok') setUnlocked(true)
    return result
  }, [])

  const setPin = useCallback(async (newPin: string, currentPin?: string) => {
    const result = await pinApi.set(newPin, currentPin)
    if (result === 'ok') {
      setHasPin(true)
      setUnlocked(true)
    }
    return result
  }, [])

  const lock = useCallback(() => setUnlocked(false), [])

  const value = useMemo(() => ({ hasPin, unlocked, unlock, setPin, lock }), [hasPin, unlocked, unlock, setPin, lock])
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}

export function useLock(): LockState {
  const value = useContext(LockContext)
  if (!value) throw new Error('useLock must be used inside LockProvider')
  return value
}
