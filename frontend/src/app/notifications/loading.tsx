function Pulse({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />;
}

export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <Pulse className="h-7 w-24 mb-4" />
      {/* Filter pills */}
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      {/* Notification items */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Pulse className="h-4 w-48" />
            <Pulse className="h-3 w-16" />
          </div>
          <Pulse className="h-3 w-full" />
          <Pulse className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
