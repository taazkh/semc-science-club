"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="shell section">
      <h1>We couldn’t load this page.</h1>
      <p>Please try again. A saved registration will not be lost.</p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
