/**
 * EmptyState.jsx
 *
 * Reusable empty state component for consistent UX
 */

export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
      {Icon && <Icon className="h-12 w-12 text-muted-foreground opacity-50" />}
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
