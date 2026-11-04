/** Re-mounts on every navigation, so each page enters with the same short fade. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fadeUp">{children}</div>;
}
