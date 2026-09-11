"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";

export interface OnboardingTourProps {
  hasResults: boolean;
  /** True only when both panels are empty — the tour may safely fill them with a demo. */
  isWorkspaceEmpty: boolean;
  /** Fills the panels with a tour-only demo pair; never called over real user input. */
  onLoadDemoData: () => void;
  /** Runs the real comparison, same path a user's own Compare click takes. */
  onRunComparison: () => void;
  /** Resets the workspace; called only to remove a demo the tour itself introduced. */
  onClearWorkspace: () => void;
  /** Current expanded state of the Differences section, which defaults to collapsed. */
  isDifferencesExpanded: boolean;
  /** Expands Differences while its tour step is active; collapses it again once the tour
   *  moves on — but only if the tour itself was the one that opened it. */
  onSetDifferencesExpanded: (expanded: boolean) => void;
}

/** Differences starts collapsed by default, unlike the other two result sections. */
const RESULT_DIFFERENCES_SELECTOR = '[data-tour="result-differences"]';

/** Bump TOUR_VERSION whenever the tour's steps or triggers change meaningfully — it makes
 *  hasSeenTour() false again for everyone, so the tour replays once for returning visitors
 *  too. The version lives in the key's VALUE, not its name, so there's only ever this one
 *  key to overwrite — no new key accumulates in storage per bump. */
const TOUR_SEEN_STORAGE_KEY = "json-comparer:onboarding-tour-seen";
const TOUR_VERSION = "v3";
// One-time migration for the pre-v4 scheme, which encoded the version in the key NAME
// (`${TOUR_SEEN_STORAGE_KEY}:v1`, `:v2`, `:v3`, ...) and left one orphaned key behind per
// bump. TODO(remove after 2026-09-13): delete this constant, forgetLegacyTourSeenKeys, and
// its call site once returning users have had a couple of days to reload past this change.
const LEGACY_TOUR_SEEN_STORAGE_PREFIX = `${TOUR_SEEN_STORAGE_KEY}:`;
const AUTO_START_DELAY_MS = 1_500;
/** Pacing for the live demo so a viewer sees each stage rather than an instant jump. */
const DEMO_INTRO_PAUSE_MS = 500;
const DEMO_LOAD_PAUSE_MS = 700;
const DEMO_RESULT_PAUSE_MS = 400;
const DEMO_POLL_INTERVAL_MS = 50;
const DEMO_RESULT_TIMEOUT_MS = 6_000;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function hasSeenTour() {
  try {
    return window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY) === TOUR_VERSION;
  } catch {
    return false;
  }
}

function rememberTour() {
  try {
    window.localStorage.setItem(TOUR_SEEN_STORAGE_KEY, TOUR_VERSION);
  } catch {
    // Storage can be disabled; the tour and comparison workflow must remain usable.
  }
}

/** One-time cleanup of the pre-v4 per-version-named keys — see the TODO above
 *  LEGACY_TOUR_SEEN_STORAGE_PREFIX for removal timing. */
function forgetLegacyTourSeenKeys() {
  try {
    const staleKeys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(LEGACY_TOUR_SEEN_STORAGE_PREFIX)) {
        staleKeys.push(key);
      }
    }
    staleKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage can be disabled; cleanup is best-effort and never blocks the tour.
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
        example: 'Baseline: {"status":"pending"}\nCandidate: {"status":"paid"}'
      },
      popover: {
        title: "Add a baseline and candidate",
        description:
          "Put the expected response in Baseline and the response you are checking in Candidate. Paste JSON directly, use Add for a file or URL/cURL import, or use Quick upload. Prettify, Find, and Tree help you inspect each side.",
        side: "bottom",
        align: "center"
      }
    },
    {
      element: '[data-tour="array-mode"]',
      data: {
        example: 'Default: Ordered\nA: ["api", "stable"]\nB: ["stable", "api"] → mismatch'
      },
      popover: {
        title: "Choose how arrays should match",
        description:
          "Ordered is selected by default: item positions must match. Switch to Unordered when duplicates should still count but position does not matter.",
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
      element: '[data-tour="panel-actions"]',
      data: {
        example:
          "data.amount: 100 → 150\n⋯ → Copy value · Ignore path · Jump to field · Mark for review"
      },
      popover: {
        title: "Act on any line, right where it lives",
        description:
          "Once you compare, every line gets a ⋯ button — or right-click it, or press Shift+F10. Copy its exact path or value, ignore or restore that field, jump to its match on the other side, or mark a finding for review and add a note.",
        side: "bottom",
        align: "start"
      }
    },
    {
      element: hasResults ? '[data-tour="results"]' : undefined,
      data: {
        // Once real results exist, this same counts/filter row is highlighted right behind
        // the popover — a canned example would only repeat what's already on screen.
        example: hasResults
          ? undefined
          : "133 of 165 differences shown\nFilter by path · Only in Baseline/Candidate · Show ignored"
      },
      popover: {
        title: "Review and export the findings",
        description: hasResults
          ? "These counts, the path filter, and the source chips control what's shown in the three sections below: Structure Schema Compare, Missing Fields, and Differences."
          : "After comparing, this area shows totals, filters, and three collapsible sections — Structure Schema Compare, Missing Fields, and Differences — each covered next. Replay this tour after comparing to see them highlighted.",
        side: "top",
        align: "center"
      }
    },
    {
      element: hasResults ? '[data-tour="result-structure"]' : undefined,
      data: {
        example: hasResults
          ? undefined
          : "meta.version: number in Baseline, string in Candidate → type mismatch"
      },
      popover: {
        title: "Spot schema-level differences",
        description: hasResults
          ? "Structure Schema Compare flags fields that are structurally missing, extra, or a different type between the two sides — independent of their actual values."
          : "Structure Schema Compare flags fields that are structurally missing, extra, or a different type between the two sides. Replay this tour after comparing to see it highlighted.",
        side: "top",
        align: "center"
      }
    },
    {
      element: hasResults ? '[data-tour="result-missing"]' : undefined,
      data: {
        example: hasResults
          ? undefined
          : "data.currency → Only in Candidate\nSelect → add review note → export .md"
      },
      popover: {
        title: "Review fields only on one side",
        description: hasResults
          ? "Missing Fields groups values present only in Baseline or only in Candidate. Select rows, add a review note, and export them as a privacy-marked Markdown report."
          : "Missing Fields groups values present only in Baseline or only in Candidate, ready to select, annotate, and export. Replay this tour after comparing to see it highlighted.",
        side: "top",
        align: "center"
      }
    },
    {
      element: hasResults ? RESULT_DIFFERENCES_SELECTOR : undefined,
      data: {
        example: hasResults ? undefined : "data.amount: 100 → 150 (changed)"
      },
      popover: {
        title: "See exactly what changed",
        description: hasResults
          ? "Differences lists every field present on both sides whose value or type changed, with the exact Baseline and Candidate values side by side."
          : "Differences lists every field present on both sides whose value or type changed. Replay this tour after comparing to see it highlighted.",
        side: "top",
        align: "center"
      }
    }
  ];
}

export function OnboardingTour({
  hasResults,
  isWorkspaceEmpty,
  onLoadDemoData,
  onRunComparison,
  onClearWorkspace,
  isDifferencesExpanded,
  onSetDifferencesExpanded
}: OnboardingTourProps) {
  const tourRef = useRef<Driver | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const hasResultsRef = useRef(hasResults);
  const isWorkspaceEmptyRef = useRef(isWorkspaceEmpty);
  const onLoadDemoDataRef = useRef(onLoadDemoData);
  const onRunComparisonRef = useRef(onRunComparison);
  const onClearWorkspaceRef = useRef(onClearWorkspace);
  const isDifferencesExpandedRef = useRef(isDifferencesExpanded);
  const onSetDifferencesExpandedRef = useRef(onSetDifferencesExpanded);
  const hasStartedRef = useRef(false);
  /** True once this tour session has filled the panels with its own demo data. */
  const demoInjectedRef = useRef(false);
  /** Guards against a second demo run while one is already animating. */
  const isRunningDemoRef = useRef(false);
  /** True only while the tour itself is holding Differences open for its own step. */
  const expandedDifferencesForTourRef = useRef(false);

  useEffect(() => {
    hasResultsRef.current = hasResults;
    isWorkspaceEmptyRef.current = isWorkspaceEmpty;
    onLoadDemoDataRef.current = onLoadDemoData;
    onRunComparisonRef.current = onRunComparison;
    onClearWorkspaceRef.current = onClearWorkspace;
    isDifferencesExpandedRef.current = isDifferencesExpanded;
    onSetDifferencesExpandedRef.current = onSetDifferencesExpanded;
  }, [
    hasResults,
    isWorkspaceEmpty,
    onLoadDemoData,
    onRunComparison,
    onClearWorkspace,
    isDifferencesExpanded,
    onSetDifferencesExpanded
  ]);

  /**
   * Announces the demo, loads the pair, pauses so it's visible landing in the panels, runs
   * the real comparison, and waits for it to resolve before advancing — so "Next" out of
   * panel-actions shows the results sections happening live instead of jumping straight
   * to description-only fallback text.
   *
   * `resultSteps` are the last 4 steps of THIS running tour's own steps array, built while
   * hasResults was still false (so their `element` is undefined and their `data.example` is
   * the illustrative fallback text). driver.js reads that array by live reference on every
   * navigation, not just once at drive() time, so mutating `.element`/`.popover`/`.data` on
   * these same objects — once real results exist — is enough to make the next navigation
   * highlight the real DOM, with real copy, instead of the no-element fallback.
   */
  const runLiveDemo = useCallback(
    async (activeTour: Driver, reduceMotion: boolean, resultSteps: DriveStep[]) => {
      // highlight() re-renders the current popover in place (it doesn't touch step-index
      // navigation state), so the panel-actions target and side/align stay put and only the
      // copy changes — telling the viewer what's about to happen before the panels do.
      activeTour.highlight({
        element: '[data-tour="panel-actions"]',
        popover: {
          title: "Loading a live example…",
          description:
            "We'll fill both panels with a sample comparison and run it, so the next few steps can show you the real results sections instead of just describing them.",
          side: "bottom",
          align: "start"
        }
      });
      await wait(reduceMotion ? 0 : DEMO_INTRO_PAUSE_MS);
      // isRunningDemoRef is cleared by onDestroyStarted if the tour closes mid-demo — bail
      // at every checkpoint so a cancelled run can't compare against an already-cleared
      // workspace or advance a driver.js instance that no longer exists.
      if (!isRunningDemoRef.current) return;

      onLoadDemoDataRef.current();
      await wait(reduceMotion ? 0 : DEMO_LOAD_PAUSE_MS);
      if (!isRunningDemoRef.current) return;
      onRunComparisonRef.current();

      const deadline = Date.now() + DEMO_RESULT_TIMEOUT_MS;
      while (!hasResultsRef.current && Date.now() < deadline) {
        await wait(DEMO_POLL_INTERVAL_MS);
        if (!isRunningDemoRef.current) return;
      }
      if (hasResultsRef.current) {
        const liveResultSteps = buildOnboardingSteps(true).slice(-resultSteps.length);
        resultSteps.forEach((step, index) => {
          const live = liveResultSteps[index];
          if (!live) return;
          step.element = live.element;
          step.popover = { ...step.popover, description: live.popover?.description };
          // The fallback example text becomes redundant once the real thing is on screen —
          // buildOnboardingSteps(true) already omits it, so drop it here too.
          step.data = { ...step.data, example: live.data?.example };
        });
      }
      await wait(reduceMotion ? 0 : DEMO_RESULT_PAUSE_MS);
      if (!isRunningDemoRef.current) return;
      isRunningDemoRef.current = false;
      activeTour.moveNext();
    },
    []
  );

  const startTour = useCallback(() => {
    hasStartedRef.current = true;
    tourRef.current?.destroy();
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const steps = buildOnboardingSteps(hasResultsRef.current);
    const panelActionsStep = steps.find((step) => step.element === '[data-tour="panel-actions"]');
    // The 4 steps after panel-actions all describe results that don't exist yet on a first
    // visit — see runLiveDemo for how they get upgraded to real highlights in place.
    const resultSteps = steps.slice(-4);
    if (panelActionsStep) {
      panelActionsStep.popover = {
        ...panelActionsStep.popover,
        onNextClick: (_element, _step, { driver: activeTour }) => {
          if (isRunningDemoRef.current) return;
          if (hasResultsRef.current || !isWorkspaceEmptyRef.current) {
            activeTour.moveNext();
            return;
          }
          isRunningDemoRef.current = true;
          demoInjectedRef.current = true;
          void runLiveDemo(activeTour, reduceMotion, resultSteps);
        }
      };
    }

    const tour = driver({
      steps,
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
      // Differences defaults to collapsed, so its step would otherwise highlight an empty
      // shell. Open it only while that step is active, and only if the tour is the one that
      // opened it — never collapse it out from under a viewer who had it open already.
      onHighlightStarted: (_element, step) => {
        if (step?.element !== RESULT_DIFFERENCES_SELECTOR || isDifferencesExpandedRef.current)
          return;
        expandedDifferencesForTourRef.current = true;
        onSetDifferencesExpandedRef.current(true);
      },
      onDeselected: (_element, step) => {
        if (step?.element !== RESULT_DIFFERENCES_SELECTOR || !expandedDifferencesForTourRef.current)
          return;
        expandedDifferencesForTourRef.current = false;
        onSetDifferencesExpandedRef.current(false);
      },
      onDestroyStarted: (_element, _step, { driver: activeTour }) => {
        activeTour.destroy();
        rememberTour();
        isRunningDemoRef.current = false;
        if (demoInjectedRef.current) {
          demoInjectedRef.current = false;
          onClearWorkspaceRef.current();
        }
        tourRef.current = null;
        window.queueMicrotask(() => launcherRef.current?.focus());
      }
    });

    tourRef.current = tour;
    tour.drive();
  }, [runLiveDemo]);

  useEffect(() => {
    forgetLegacyTourSeenKeys();
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
