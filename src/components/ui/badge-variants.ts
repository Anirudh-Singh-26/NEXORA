import { cva } from 'class-variance-authority'

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase',
  {
    variants: {
      variant: {
        default: 'border-line bg-inset text-mute',
        copper: 'border-copper/30 bg-copper/10 text-copper',
        sage: 'border-sage/30 bg-sage/10 text-sage',
        live: 'border-gain/30 bg-gain/10 text-gain',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)
