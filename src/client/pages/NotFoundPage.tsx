export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-gray-600 mb-4">404</h1>
      <p className="text-gray-400">Room not found</p>
      <a href="/" className="mt-6 text-blue-400 hover:text-blue-300">
        Go home
      </a>
    </div>
  );
}
