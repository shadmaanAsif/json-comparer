import type { HighlightCategory } from "../types";

/**
 * The single finding navigator shared by both panels, living in its own narrow column between
 * them rather than floating over the panels. Stacked into four lines — status, Previous, Next,
 * Advanced View — so it stays narrow and centered instead of stretching wide, leaving room to
 * add more options later without widening the column. Previous/Next step through every
 * highlighted line across the aligned panels; the last button scrolls down to reveal the
 * comparison output section below.
 */
export function WorkspaceFindingNav({
  categories,
  current,
  total,
  onPrevious,
  onNext,
  onScrollToOutput
}: {
  categories: HighlightCategory[];
  current: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onScrollToOutput: () => void;
}) {
  if (!total) return null;
  return (
    <div className="workspace-finding-nav" data-tour="finding-nav" aria-label="Finding navigation">
      <div className="finding-nav-status">
        <CategoryDots categories={categories} />
        <span className="finding-nav-count" aria-live="polite">
          Finding {current} of {total}
        </span>
      </div>
      <button type="button" className="finding-nav-step" onClick={onPrevious}>
        <span aria-hidden="true">↑</span> Previous
      </button>
      <button type="button" className="finding-nav-step" onClick={onNext}>
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
