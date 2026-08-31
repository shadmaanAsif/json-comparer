import type { HighlightCategory } from "../types";

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
