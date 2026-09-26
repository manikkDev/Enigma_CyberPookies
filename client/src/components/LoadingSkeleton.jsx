/**
 * LoadingSkeleton.jsx
 *
 * Loading skeleton components for better perceived performance
 */

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-3 w-3 rounded-full bg-muted" />
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded bg-muted" />
            <div className="h-5 w-20 rounded bg-muted" />
          </div>
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
          <div className="h-8 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-center animate-pulse">
      <div className="mx-auto h-6 w-12 rounded bg-muted mb-2" />
      <div className="mx-auto h-3 w-16 rounded bg-muted" />
    </div>
  );
}

export default function LoadingSkeleton({ variant = 'card', rows = 5 }) {
  if (variant === 'table') return <TableSkeleton rows={rows} />;
  if (variant === 'stat') return <StatCardSkeleton />;
  return <CardSkeleton />;
}
