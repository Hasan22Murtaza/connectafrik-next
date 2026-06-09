export function AdminLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-gray-500 text-sm">
      {message}
    </div>
  );
}
