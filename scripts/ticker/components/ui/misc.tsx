import * as React from 'react';
import { cn } from '../../lib/utils';

export function Separator({ className, orientation = 'horizontal', ...props }: React.ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn('bg-border shrink-0', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
      {...props}
    />
  );
}

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} className={cn('bg-muted relative h-2 w-full overflow-hidden rounded-full', className)}>
      <div className={cn('bg-primary h-full rounded-full', indicatorClassName)} style={{ width: `${v}%` }} />
    </div>
  );
}

/**
 * Tabs no padrão shadcn, sem Radix: todo painel fica no DOM (o Google lê todos);
 * o script cliente alterna `data-state` e `hidden`. Sem JS, o primeiro painel aparece.
 */
export function Tabs({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return <div data-tabs={id} className={cn('flex flex-col gap-4', className)}>{children}</div>;
}

export function TabsList({ className, children, label }: { className?: string; children: React.ReactNode; label: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('bg-muted text-muted-foreground inline-flex h-9 w-fit max-w-full items-center justify-start overflow-x-auto rounded-lg p-[3px]', className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, active, children, tabsId }: { value: string; active?: boolean; children: React.ReactNode; tabsId: string }) {
  return (
    <button
      type="button"
      role="tab"
      id={`${tabsId}-tab-${value}`}
      aria-controls={`${tabsId}-panel-${value}`}
      aria-selected={active ? 'true' : 'false'}
      data-state={active ? 'active' : 'inactive'}
      data-value={value}
      className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md px-3 py-1 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, active, children, tabsId, className }: { value: string; active?: boolean; children: React.ReactNode; tabsId: string; className?: string }) {
  return (
    <div
      role="tabpanel"
      id={`${tabsId}-panel-${value}`}
      aria-labelledby={`${tabsId}-tab-${value}`}
      data-state={active ? 'active' : 'inactive'}
      data-value={value}
      hidden={!active}
      className={cn('outline-none', className)}
    >
      {children}
    </div>
  );
}

/** Accordion shadcn sobre <details>: funciona sem JS e mantém a resposta no DOM. */
export function AccordionItem({ question, children, open }: { question: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group border-b last:border-b-0" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold hover:underline [&::-webkit-details-marker]:hidden">
        <h3 className="text-[15px] font-semibold">{question}</h3>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="text-muted-foreground pb-4 text-sm leading-relaxed">{children}</div>
    </details>
  );
}
