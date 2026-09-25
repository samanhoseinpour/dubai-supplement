// Spec §7.3: Apple's spring values (apple-design skill §4) in Motion's
// `bounce` / `duration` form — bounce 0 is damping 1.0, duration is response.
// `motion` itself is installed by the first gesture surface, not here (D12).
export const SPRING = {
  /** damping 1.0, response 0.4 — no overshoot; the default for anything that moves. */
  default: { type: 'spring', bounce: 0, duration: 0.4 },
  /** ≈ damping 0.8 — only after a flick or a throw carried momentum. */
  momentum: { type: 'spring', bounce: 0.2, duration: 0.4 },
  /** Apple's drawer and sheet values. */
  sheet: { type: 'spring', bounce: 0.2, duration: 0.3 },
} as const
