"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";

interface OnboardingTourProps {
  hasResults: boolean;
}

const TOUR_SEEN_STORAGE_KEY = "json-comparer:onboarding-tour-seen:v1";
const AUTO_START_DELAY_MS = 1_500;

function hasSeenTour() {
  try {
    return window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberTour() {
  try {
    window.localStorage.setItem(TOUR_SEEN_STORAGE_KEY, "true");
  } catch {
    // Storage can be disabled; the tour and comparison workflow must remain usable.
  }
}

export function buildOnboardingSteps(hasResults: boolean): DriveStep[] {
  return [
    {
      element: '[data-tour="privacy"]',
      data: {
        example: 'A: {"status":"ok"}\nB: {"status":"ok"} — compared locally'
      },
      popover: {
        title: "Compare JSON with confidence",
        description:
          "This quick tour explains the full workflow. Your pasted files and comparisons stay in your browser; only an explicit URL or cURL import uses the restricted fetch service.",
        side: "bottom",
        align: "end"
      }
    },
    {
      element: '[data-tour="json-inputs"]',
      data: {
        example: 'A (baseline): {"status":"pending"}\nB (candidate): {"status":"paid"}'
      },
      popover: {
        title: "Add a baseline and candidate",
        description:
          "Put the expected response in A and the response you are checking in B. Paste JSON directly, use Add for a file or URL/cURL import, or use Quick upload. Prettify, Find, and Tree help you inspect each side.",
        side: "bottom",
        align: "center"
      }
    },
    {
      element: '[data-tour="array-mode"]',
      data: {
        example: 'Default: Unordered\nA: ["api", "stable"]\nB: ["stable", "api"] → match'
      },
      popover: {
        title: "Choose how arrays should match",
        description:
          "Unordered is selected by default: order does not matter, but duplicate items still count. Switch to Ordered when item positions are part of the API contract.",
        side: "bottom",
        align: "start"
      }
    },
    {
      element: '[data-tour="ignore-paths"]',
      data: {
        example: "meta.timestamp\nitems.*.internalId\nconfig.**"
      },
      popover: {
        title: "Exclude expected noise",
        description:
          "Ignore stable differences such as timestamps. Exact paths include descendants, * matches one segment, and a final ** matches a whole subtree. Apply reruns the comparison with those rules.",
        side: "bottom",
        align: "start"
      }
    },
    {
      element: '[data-tour="highlight-controls"]',
      data: {
        example: 'A: "amount": 100\nB: "amount": 150 → changed-value highlight'
      },
      popover: {
        title: "Control the editor highlights",
        description:
          "Toggle missing fields, structure issues, or changed values in both JSON panels. These switches change the visual guidance only; they do not remove findings from the comparison.",
        side: "bottom",
        align: "start"
      }
    },
    {
      element: '[data-tour="primary-actions"]',
      data: {
        example: "1. Load sample\n2. Choose array mode\n3. Compare responses"
      },
      popover: {
        title: "Compare or practise with the sample",
        description:
          "Load sample is the fastest safe way to explore. When both responses are ready, run Compare responses. Clear all resets the workspace.",
        side: "top",
        align: "start"
      }
    },
    {
      element: hasResults ? '[data-tour="results"]' : undefined,
      data: {
        example: "data.currency → Only in B\nSelect → add review note → export .md"
      },
      popover: {
        title: "Review and export the findings",
        description: hasResults
          ? "Use the summary, path and category filters, and collapsible sections to review the output. Missing fields can be selected, annotated, and exported as a privacy-marked Markdown report."
          : "After comparing, the results area shows totals, filters, and collapsible finding sections. You can select and annotate missing fields, then export a privacy-marked Markdown report. Replay this tour later to highlight that area.",
        side: "top",
        align: "center"
      }
    }
  ];
}

export function OnboardingTour({ hasResults }: OnboardingTourProps) {
  const tourRef = useRef<Driver | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const hasResultsRef = useRef(hasResults);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    hasResultsRef.current = hasResults;
  }, [hasResults]);

  const startTour = useCallback(() => {
    hasStartedRef.current = true;
    tourRef.current?.destroy();
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tour = driver({
      steps: buildOnboardingSteps(hasResultsRef.current),
      animate: !reduceMotion,
      smoothScroll: !reduceMotion,
      allowKeyboardControl: true,
      allowScroll: true,
      overlayClickBehavior: "close",
      disableActiveInteraction: true,
      skipMissingElement: true,
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Start comparing",
      popoverClass: "json-comparer-tour",
      stagePadding: 12,
      stageRadius: 12,
      popoverOffset: 14,
      onPopoverRender: (popover, { state }) => {
        popover.wrapper.setAttribute("aria-modal", "true");
        popover.closeButton.setAttribute("aria-label", "Exit guided tour");

        const exampleText = state.activeStep?.data?.example;
        if (typeof exampleText !== "string") return;

        const example = document.createElement("div");
        example.className = "tour-example";
        const exampleLabel = document.createElement("strong");
        exampleLabel.textContent = "Example";
        const exampleCode = document.createElement("code");
        exampleCode.textContent = exampleText;
        example.append(exampleLabel, exampleCode);
        popover.description.after(example);
      },
      onDestroyStarted: (_element, _step, { driver: activeTour }) => {
        activeTour.destroy();
        rememberTour();
        tourRef.current = null;
        window.queueMicrotask(() => launcherRef.current?.focus());
      }
    });

    tourRef.current = tour;
    tour.drive();
  }, []);

  useEffect(() => {
    const autoStartTimer = hasSeenTour()
      ? null
      : window.setTimeout(() => {
          if (!hasStartedRef.current) startTour();
        }, AUTO_START_DELAY_MS);

    return () => {
      if (autoStartTimer !== null) window.clearTimeout(autoStartTimer);
      tourRef.current?.destroy();
    };
  }, [startTour]);

  return (
    <button
      ref={launcherRef}
      className="secondary-button tour-button"
      type="button"
      aria-haspopup="dialog"
      onClick={() => startTour()}
    >
      <span aria-hidden="true">?</span>
      Guided tour
    </button>
  );
}
