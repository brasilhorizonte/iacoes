import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// shadcn/ui Button — versão estática: sem Slot/Radix, porque a página é renderizada
// para HTML puro no build. Para links use <ButtonLink>, que aplica as mesmas variantes.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        gold: 'bg-gold text-gold-foreground shadow-sm hover:bg-gold/90',
        outline: 'border border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        'outline-dark': 'border border-white/20 bg-white/5 text-white hover:bg-white/10',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md gap-1.5 px-3 text-xs',
        lg: 'h-11 rounded-md px-6 text-base',
        xl: 'h-12 rounded-lg px-7 text-base',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof buttonVariants> & {
    /** ID de tracking: vira data-cta e ganha onclick="_iaClick(event)" no pós-processamento. */
    cta?: string;
  };

export function ButtonLink({ className, variant, size, cta, href, children, ...props }: ButtonLinkProps) {
  return (
    <a href={href} data-cta={cta} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </a>
  );
}
