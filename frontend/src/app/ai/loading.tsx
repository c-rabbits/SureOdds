function Pulse({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />;
}

export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <Pulse className="h-3 w-16 mb-2" />
            <Pulse className="h-6 w-12" />
          </div>
        ))}
      </div>
      {/* Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Pulse className="h-3 w-20" />
              <Pulse className="h-3 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <Pulse className="h-4 w-24" />
              <Pulse className="h-4 w-24" />
            </div>
            <Pulse className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
