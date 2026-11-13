import { GraduationCap, KeyRound, LayoutDashboard, ListChecks, LogOut, Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { PinInput } from '../components/PinInput'
import { Button, Modal } from '../components/ui'
import { cn } from '../lib/format'
import { useAuth } from '../state/auth'
import { useLock } from '../state/lock'

const NAV = [
  { to: '/parent', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/parent/assignments', end: false, label: 'Assignments', icon: ListChecks },
  { to: '/parent/assistant', end: false, label: 'Assistant', icon: Sparkles },
]

export default function ParentShell() {
  const { demo, email, signOut } = useAuth()
  const { lock } = useLock()
  const [changingPin, setChangingPin] = useState(false)

  return (
    <div className="min-h-dvh lg:pl-60">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <div className="px-2 pb-6">
          <Brand />
        </div>
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-faint uppercase">Parent portal</p>
        <nav className="space-y-0.5">
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-sunken hover:text-ink',
                )
              }
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-1">
          {demo && (
            <div className="mb-2 rounded-xl bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn">
              <span className="font-semibold">Demo mode.</span> Sample data, saved in this browser only.
            </div>
          )}
          <Link to="/" onClick={lock} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
            <GraduationCap className="size-4" /> Lock and go to student view
          </Link>
          <button type="button" onClick={() => setChangingPin(true)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
            <KeyRound className="size-4" /> Change PIN
          </button>
          {!demo && (
            <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
              <LogOut className="size-4 shrink-0" /> <span className="truncate">Sign out{email ? ` (${email})` : ''}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-canvas/85 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setChangingPin(true)} aria-label="Change PIN" className="grid size-8 place-items-center rounded-xl text-muted hover:bg-sunken">
            <KeyRound className="size-4" />
          </button>
          <Link to="/" onClick={lock} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-muted hover:bg-sunken">
            <GraduationCap className="size-4" /> Student view
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 sm:px-8 lg:pt-10 lg:pb-12">
        <Outlet />
      </main>

      {/* Tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-accent-ink' : 'text-faint')}>
            <Icon className="size-5" /> {label}
          </NavLink>
        ))}
      </nav>

      {changingPin && <ChangePinModal onClose={() => setChangingPin(false)} />}
    </div>
  )
}

function ChangePinModal({ onClose }: { onClose(): void }) {
  const { setPin } = useLock()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const result = await setPin(next, current)
      if (result === 'ok') return onClose()
      setError(result === 'locked' ? 'Too many wrong tries. Wait 5 minutes and try again.' : "The current PIN isn't right.")
      setCurrent('')
    } catch (cause) {
      console.error(cause)
      setError("Couldn't save the PIN. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Change parent PIN">
      <div className="space-y-5 py-2 text-center">
        <div>
          <p className="mb-2 text-[13px] font-medium">Current PIN</p>
          <PinInput label="Current PIN" value={current} onChange={setCurrent} invalid={error !== null} />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium">New PIN</p>
          <PinInput label="New PIN" value={next} onChange={setNext} />
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy || current.length < 4 || next.length < 4} onClick={() => void save()}>Save PIN</Button>
      </div>
    </Modal>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
