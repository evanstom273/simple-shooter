// Phone vibration (Android Chrome; iOS has no vibration API). Touch play only.
import { touchInput } from './controls.ts'

export function buzz(ms: number) {
  if (!touchInput.controlsShown) return
  try {
    navigator.vibrate?.(Math.round(ms))
  } catch {
    // Some browsers throw if vibration isn't allowed yet; nothing to do.
  }
}
