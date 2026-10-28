import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-copper text-canvas hover:bg-copper/90',
        outline: 'border border-line bg-transparent text-ink hover:bg-inset',
        ghost: 'text-ink hover:bg-inset',
        subtle: 'bg-inset text-ink hover:bg-line/60',
        copper: 'border border-copper/40 bg-copper/10 text-copper hover:bg-copper/15',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-5',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
