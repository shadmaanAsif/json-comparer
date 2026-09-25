import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="Site" className="site-footer-nav">
        <Link href="/">Compare</Link>
        <Link href="/about">About</Link>
        <Link href="/docs">Documentation</Link>
      </nav>
      <p className="site-footer-note">
        Runs entirely in your browser — JSON payloads are never uploaded or logged.
      </p>
    </footer>
  );
}
