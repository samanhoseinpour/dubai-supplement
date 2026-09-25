import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  PackageOpen,
  X,
} from 'lucide-react'

// The only file that imports lucide-react (spec §8.2, enforced by lint).
// Names are semantic, and direction is decided here once: this store is
// right-to-left permanently (D3), so forward is left and back is right.
export const IconForward = ChevronLeft
export const IconBack = ChevronRight
export const IconExternal = ExternalLink
export const IconClose = X
export const IconCheck = Check
export const IconSpinner = LoaderCircle
export const IconAlert = CircleAlert
export const IconEmpty = PackageOpen

export type Icon = typeof Check

/** Icons render at 16, 20 or 24 px and nothing else. */
export const ICON_SIZE = { sm: 16, md: 20, lg: 24 } as const
export type IconSize = keyof typeof ICON_SIZE
