import { PolarisMark } from "@/components/ui/Polaris";

export function SiteFooter() {
  return (
    <footer className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4 text-xs text-muted">
      <span className="flex items-center gap-1.5 font-head font-semibold tracking-wider text-star">
        <PolarisMark size={13} />
        Built by Team Polaris
      </span>
      <span>NASA Space Apps Challenge 2026</span>
      <span className="basis-full sm:basis-auto">Data: NASA Physical Sciences Informatics. Independent student project, not endorsed by NASA.</span>
    </footer>
  );
}
