export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}
