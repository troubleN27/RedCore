import { Skeleton } from '@/components/ui/skeleton';

// Скелетоны страниц для loading.tsx: графитовый шиммер в форме будущего содержимого —
// без «прыжка» вёрстки, когда данные приходят (CLS = 0).

function Title() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-64 bg-graphite-800" />
      <Skeleton className="h-4 w-96 max-w-full bg-graphite-800" />
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-graphite-800 p-3">
          <Skeleton className="aspect-square w-full bg-graphite-800" />
          <Skeleton className="h-4 w-4/5 bg-graphite-800" />
          <Skeleton className="h-5 w-1/2 bg-graphite-800" />
        </div>
      ))}
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <Title />
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-graphite-800" />
          ))}
        </div>
        <CardGridSkeleton />
      </div>
    </div>
  );
}

export function PanelsSkeleton() {
  return (
    <div className="mx-auto max-w-[96rem] space-y-8 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <Title />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[15rem_minmax(0,1fr)_24rem]">
        <Skeleton className="hidden h-96 bg-graphite-800 xl:block" />
        <div className="space-y-4">
          <Skeleton className="h-72 w-full rounded-xl bg-graphite-800 sm:h-96" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-graphite-800" />
          ))}
        </div>
        <Skeleton className="h-96 bg-graphite-800" />
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <Title />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full bg-graphite-800" />
      ))}
    </div>
  );
}
