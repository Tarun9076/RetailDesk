/** Shown at once while the next desk screen loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-surface" />
      <div className="mt-4 flex gap-2">
        <div className="h-11 w-40 rounded-full bg-surface" />
        <div className="h-11 w-40 rounded-full bg-surface" />
        <div className="h-11 w-28 rounded-full bg-surface" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
