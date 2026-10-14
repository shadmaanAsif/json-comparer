import type { HighlightCategory } from "../types";

/**
 * The single finding navigator shared by both panels, living in its own narrow column between
 * them rather than floating over the panels. Stacked into short centered lines — status, an
 * optional ignored tally, Previous, Next, Advanced View — so it stays narrow instead of
 * stretching wide. Previous/Next step through every highlighted line across the aligned panels
 * except ignored ones; those are tallied on their own dimmed, non-interactive line so the
 * "Finding X of Y" count means exactly what Previous/Next can reach. The last button scrolls down
 * to reveal the comparison output section below.
 */
export function WorkspaceFindingNav({
  categories,
  current,
  total,
  ignored = 0,
  onPrevious,
  onNext,
  onScrollToOutput
}: {
  categories: HighlightCategory[];
  current: number;
  total: number;
  /** Highlighted lines suppressed by ignore paths: excluded from `total` and from stepping. */
  ignored?: number;
  onPrevious: () => void;
  onNext: () => void;
  onScrollToOutput: () => void;
}) {
  // Stay mounted while everything is ignored, so the tally (and the way down to the output) don't
  // vanish the moment the last active finding is ignored.
  if (!total && !ignored) return null;
  const hasFindings = total > 0;
  return (
    <div className="workspace-finding-nav" data-tour="finding-nav" aria-label="Finding navigation">
      <div className="finding-nav-status">
        {hasFindings && <CategoryDots categories={categories} />}
        <span className="finding-nav-count" aria-live="polite">
          {hasFindings ? `Finding ${current} of ${total}` : "No active findings"}
        </span>
      </div>
      {ignored > 0 && (
        <div
          className="finding-nav-ignored"
          title="Suppressed by your ignore paths: not counted above and skipped by Previous/Next"
        >
          <span className="finding-nav-ignored-dot" aria-hidden="true" />
          {ignored} ignored
        </div>
      )}
      <button type="button" className="finding-nav-step" disabled={!hasFindings} onClick={onPrevious}>
        <span aria-hidden="true">↑</span> Previous
      </button>
      <button type="button" className="finding-nav-step" disabled={!hasFindings} onClick={onNext}>
        Next <span aria-hidden="true">↓</span>
      </button>
      <button type="button" className="finding-nav-output" onClick={onScrollToOutput}>
        Advanced View <span aria-hidden="true">⤓</span>
      </button>
    </div>
  );
}

export function CategoryDots({ categories }: { categories: HighlightCategory[] }) {
  return (
    <span className="chip-dots" aria-hidden="true">
      {categories.map((category) => (
        <i key={category} className={`dot-${category}`} />
      ))}
    </span>
  );
}

export function FindingStepper({
  label,
  categories,
  current,
  total,
  onPrevious,
  onNext
}: {
  label: string;
  categories: HighlightCategory[];
  current: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (!total) return null;

  return (
    <div className="error-stepper" aria-label={`${label} finding navigation`}>
      <CategoryDots categories={categories} />
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous highlighted finding"
        title="Previous finding"
      >
        ↑
      </button>
      <span aria-live="polite">
        {current}/{total}
      </span>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next highlighted finding"
        title="Next finding"
      >
        ↓
      </button>
    </div>
  );
}
