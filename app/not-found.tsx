import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="hud-panel mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="font-head text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That page is not on this habitat&apos;s map.</p>
      <Link href="/" className="mt-4 inline-block rounded-md bg-ember px-4 py-2 text-sm font-semibold text-bg transition hover:brightness-110">
        Back to Mission overview
      </Link>
    </section>
  );
}
