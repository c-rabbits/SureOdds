function Pulse({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />;
}

export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <Pulse className="h-7 w-32 mb-2" />
        <Pulse className="h-4 w-48" />
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex gap-4">
          <Pulse className="h-8 w-24" />
          <Pulse className="h-8 w-24" />
          <Pulse className="h-8 w-24" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-800/30">
            <Pulse className="h-4 w-4" />
            <Pulse className="h-4 w-32" />
            <Pulse className="h-4 w-16" />
            <Pulse className="h-4 w-12" />
            <Pulse className="h-4 w-12" />
            <Pulse className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
