/** Shown at once while the next screen's data loads, so a tap always feels answered. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-12 rounded-xl bg-surface" />
      <div className="mt-3 flex gap-2">
        <div className="h-11 w-16 rounded-full bg-surface" />
        <div className="h-11 w-28 rounded-full bg-surface" />
        <div className="h-11 w-28 rounded-full bg-surface" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-72 rounded-2xl bg-surface" />
        ))}
      </div>
    </div>
  );
}
