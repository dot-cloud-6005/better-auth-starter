export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-5 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted/60 rounded animate-pulse w-3/4" />
        </div>
        <div className="space-y-1">
          <div className="h-3 bg-muted/40 rounded animate-pulse w-5/6" />
          <div className="h-3 bg-muted/40 rounded animate-pulse w-4/6" />
          <div className="h-3 bg-muted/40 rounded animate-pulse w-3/6" />
        </div>
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4">
        <div className="h-8 bg-muted rounded animate-pulse w-64 mb-2" />
        <div className="h-4 bg-muted/60 rounded animate-pulse w-96" />
      </div>
      
      <div className="space-y-4">
        <div className="flex space-x-1 bg-muted rounded-lg p-1">
          <div className="h-10 bg-muted-foreground/20 rounded animate-pulse flex-1" />
          <div className="h-10 bg-muted-foreground/20 rounded animate-pulse flex-1" />
          <div className="h-10 bg-muted-foreground/20 rounded animate-pulse flex-1" />
          <div className="h-10 bg-muted-foreground/20 rounded animate-pulse flex-1" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
