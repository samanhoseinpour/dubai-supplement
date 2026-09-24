import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge knows Tailwind's default scales. Spec §5.1 deletes them and
// defines ours, so without this `cn('text-body', 'text-foreground')` would read
// `text-body` as a second colour and drop it. Every deleted namespace that has
// a replacement is listed; keep this in step with app/globals.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['caption', 'small', 'body', 'lead', 'title-sm', 'title', 'headline', 'display'],
      radius: ['sm', 'md', 'lg', 'full'],
      shadow: ['sm', 'md', 'material'],
      ease: ['out', 'in'],
      animate: ['shimmer', 'spin'],
      'font-weight': ['normal', 'medium', 'semibold', 'bold', 'extrabold'],
    },
    classGroups: {
      z: ['z-header', 'z-overlay', 'z-sheet', 'z-toast'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
