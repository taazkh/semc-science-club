import Link from "next/link";
export default function NotFound() {
  return (
    <div className="shell section">
      <h1>That page isn’t here.</h1>
      <p>The link may have changed, or the content is not published yet.</p>
      <Link className="button button-primary" href="/">
        Return home
      </Link>
    </div>
  );
}
