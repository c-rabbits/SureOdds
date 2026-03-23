function Pulse({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />;
}

export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-9 w-20 rounded-lg" />
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-800/30">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-4 w-40" />
            <Pulse className="h-4 w-20" />
            <Pulse className="h-4 w-16" />
            <div className="flex-1" />
            <Pulse className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
