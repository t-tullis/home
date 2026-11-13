import { supabase } from './supabase'

export type PinResult = 'ok' | 'wrong' | 'locked'

export interface PinApi {
  hasPin(): Promise<boolean>
  verify(pin: string): Promise<PinResult>
  /** Setting the first PIN needs no current PIN. Changing it needs the current PIN or a fresh sign-in. */
  set(newPin: string, currentPin?: string): Promise<PinResult>
}

// The hash never reaches the browser: these call database functions that
// check it server-side and count wrong tries.
const supabasePin: PinApi = {
  async hasPin() {
    const { data, error } = await supabase!.rpc('has_parent_pin')
    if (error) throw error
    return data as boolean
  },
  async verify(pin) {
    const { data, error } = await supabase!.rpc('verify_parent_pin', { pin })
    if (error) throw error
    return data as PinResult
  },
  async set(newPin, currentPin) {
    const { data, error } = await supabase!.rpc('set_parent_pin', { new_pin: newPin, current_pin: currentPin ?? null })
    if (error) throw error
    return data as PinResult
  },
}

// Demo mode keeps the PIN in this browser, unhashed, and lets it be replaced
// without the old one. It only exists so the lock screens can be tried out.
const DEMO_KEY = 'homeroom-demo-pin'
const demoPin: PinApi = {
  async hasPin() {
    return localStorage.getItem(DEMO_KEY) !== null
  },
  async verify(pin) {
    return localStorage.getItem(DEMO_KEY) === pin ? 'ok' : 'wrong'
  },
  async set(newPin, currentPin) {
    const existing = localStorage.getItem(DEMO_KEY)
    if (existing !== null && currentPin !== undefined && currentPin !== existing) return 'wrong'
    localStorage.setItem(DEMO_KEY, newPin)
    return 'ok'
  },
}

export const pinApi: PinApi = supabase ? supabasePin : demoPin
