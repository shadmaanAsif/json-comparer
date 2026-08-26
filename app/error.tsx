"use client";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="fatal-error">
      <h1>Something went wrong</h1>
      <p>Your JSON has not been sent anywhere. Reload the comparer or try again.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
