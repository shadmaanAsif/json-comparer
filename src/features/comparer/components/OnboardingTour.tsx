"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";

export interface OnboardingTourProps {
  hasResults: boolean;
  /** True once Advanced View has revealed comparison settings (array mode, ignore paths). */
  settingsRevealed: boolean;
  /** True only when both panels are empty — the tour may safely fill them with a demo. */
  isWorkspaceEmpty: boolean;
  /** Fills the panels with a tour-only demo pair; never called over real user input. */
  onLoadDemoData: () => void;
  /** Runs the real comparison directly, without waiting on the auto-compare debounce, so the
   *  live demo's timing stays deterministic instead of racing that timer. */
  onRunComparison: () => void;
  /** Expands the collapsed comparison-output section so the results/result-* steps highlight
   *  real, visible content instead of a collapsed (inert) section. Deliberately separate from
   *  Advanced View's own settings reveal — the live demo calls this without ever revealing
   *  comparison settings, so it doesn't spoil that surprise for a first-time visitor. */
  onExpandResults: () => void;
  /** Resets the workspace; called only to remove a demo the tour itself introduced. */
  onClearWorkspace: () => void;
}

const RESULT_DIFFERENCES_SELECTOR = '[data-tour="result-differences"]';

/** Bump TOUR_VERSION whenever the tour's steps or triggers change meaningfully — it makes
 *  hasSeenTour() false again for everyone, so the tour replays once for returning visitors
 *  too. The version lives in the key's VALUE, not its name, so there's only ever this one
 *  key to overwrite — no new key accumulates in storage per bump. */
const TOUR_SEEN_STORAGE_KEY = "json-comparer:onboarding-tour-seen";
const TOUR_VERSION = "v21";
// One-time migration for the pre-v4 scheme, which encoded the version in the key NAME
// (`${TOUR_SEEN_STORAGE_KEY}:v1`, `:v2`, `:v3`, ...) and left one orphaned key behind per
// bump. TODO(remove after 2026-09-13): delete this constant, forgetLegacyTourSeenKeys, and
// its call site once returning users have had a couple of days to reload past this change.
const LEGACY_TOUR_SEEN_STORAGE_PREFIX = `${TOUR_SEEN_STORAGE_KEY}:`;
const AUTO_START_DELAY_MS = 1_500;
/** Pacing for the live demo so a viewer sees each stage rather than an instant jump. */
const DEMO_INTRO_PAUSE_MS = 500;
const DEMO_SAMPLE_PAUSE_MS = 900;
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

export function buildOnboardingSteps(
  hasResults: boolean,
  settingsRevealed: boolean
): DriveStep[] {
  return [
    {
      // No dedicated element: the former privacy badge this step anchored to was removed as
      // landing-page clutter. A centered, description-only welcome step (same fallback pattern
      // used below for steps whose target doesn't exist yet) replaces it.
      element: undefined,
      data: {
        example:
          'Baseline: {"status":"ok"}\nCandidate: {"status":"okay"} — compared locally, never uploaded'
      },
      popover: {
        title: "Catch contract drift before it bites",
        description:
          "A renamed field, a flipped type, a value that quietly changed — this quick tour shows exactly how to catch it. Everything compares right here in your browser; only an explicit URL or cURL import touches the restricted fetch service.",
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
          "Put the expected response in Baseline and the response you are checking in Candidate. Paste JSON directly, drag and drop a file, use Add for a URL/cURL import, or use Quick upload. Prettify, Find, and Tree help you inspect each side.",
        side: "bottom",
        align: "center"
      }
    },
    // Comparison settings (this step and ignore-paths) stay out of the DOM until Advanced View
    // is clicked after a compare — see comparisonSettingsVisible in Comparer.tsx. A first-time
    // visitor reaches this step before that ever happens, so it falls back to description-only
    // like the hasResults-gated steps below; unlike those, the live demo never clicks Advanced
    // View, so this one never gets upgraded to a real highlight mid-demo.
    {
      element: settingsRevealed ? '[data-tour="array-mode"]' : undefined,
      data: {
        example: settingsRevealed
          ? undefined
          : 'Default: Ordered\nA: ["api", "stable"]\nB: ["stable", "api"] → mismatch'
      },
      popover: {
        title: "Choose how arrays should match",
        description: settingsRevealed
          ? "Ordered is selected by default: item positions must match. Switch to Unordered when duplicates should still count but position does not matter."
          : "Click Advanced View after comparing to reveal comparison settings. Ordered is selected by default: item positions must match; switch to Unordered when duplicates should still count but position does not matter.",
        side: "bottom",
        align: "start"
      }
    },
    {
      element: settingsRevealed ? '[data-tour="ignore-paths"]' : undefined,
      data: {
        example: settingsRevealed ? undefined : "meta.timestamp\nitems.*.internalId\nconfig.**"
      },
      popover: {
        title: "Exclude expected noise",
        description: settingsRevealed
          ? "Ignore stable differences such as timestamps. Exact paths include descendants, * matches one segment, and a final ** matches a whole subtree. Apply reruns the comparison with those rules."
          : "Also revealed by Advanced View: ignore stable differences such as timestamps. Exact paths include descendants, * matches one segment, and a final ** matches a whole subtree.",
        side: "bottom",
        align: "start"
      }
    },
    {
      element: '[data-tour="primary-actions"]',
      data: {
        example:
          "1. Paste or drop JSON in both panels\n2. Comparison runs automatically\n3. Toggle Compare responses off to pause it"
      },
      popover: {
        title: "Comparison runs automatically",
        description:
          "As soon as both Baseline and Candidate hold valid JSON, they're compared — no extra step. Uncheck Compare responses to pause it. Clear all resets the workspace, and the panel-size toggle next to it makes both JSON panels taller or shorter together.",
        side: "bottom",
        align: "start"
      }
    },
    // Right after primary-actions, not after panel-actions: HighlightControls renders inline in
    // the same .panel-toolbar-actions row primary-actions already targets (a stacked card and a
    // floating popover were both tried in the narrow workspace-side-panel column between the
    // panels, and both overflowed onto the JSON panel beside it — the chips' text, "Structure
    // schema" etc., doesn't fit that ~112-148px column). Visiting this step right after
    // primary-actions is a zero-scroll transition since it's the same toolbar. The chips only
    // render once a comparison is active (Comparer hides them until then), so this step starts
    // with no element to anchor to — but the live demo (see runLiveDemo) triggers from
    // primary-actions, the step immediately before this one, and upgrades it to the real
    // highlight before a first-time visitor ever sees it. Only a visitor who already has real
    // results, or brought their own unsaved input into the tour, skips the demo and can still
    // land here on the description-only fallback.
    {
      element: hasResults ? '[data-tour="highlight-controls"]' : undefined,
      data: {
        example: hasResults
          ? undefined
          : 'A: "amount": 100\nB: "amount": 150 → changed-value highlight'
      },
      popover: {
        title: "Control the editor highlights",
        description: hasResults
          ? "Toggle missing fields, structure issues, or changed values in both JSON panels. These switches change the visual guidance only; they do not remove findings from the comparison. A shortcut between the two panels below jumps back up to this toolbar once it has scrolled out of view."
          : "Once you compare, this appears in the toolbar so you can toggle missing fields, structure issues, or changed-value highlights. Replay this tour after comparing to see it.",
        side: "bottom",
        align: "start"
      }
    },
    // Right before panel-actions, not right after primary-actions: this navigator now lives
    // between the two JSON panels, below the compact "Highlight Controls" shortcut button that scrolls
    // back up to the toolbar's highlight toggles, in the same workspace-side-panel column, so
    // visiting it next to panel-actions — also inside the panels — avoids bouncing the tour
    // between the toolbar and the panels.
    {
      element: hasResults ? '[data-tour="finding-nav"]' : undefined,
      data: {
        example: hasResults ? undefined : "Finding 3 of 8 · Previous · Next · Advanced View"
      },
      popover: {
        title: "Step through every finding",
        description: hasResults
          ? "Once you compare, this navigator appears between the two panels and walks every highlighted line across both sides at once. Previous and Next move through them; Advanced View reveals comparison settings and scrolls straight down to the comparison output."
          : "Once you compare, this navigator appears between the two panels to step through every finding across both sides. Advanced View reveals comparison settings and scrolls down to the comparison output. Replay this tour after comparing to see it.",
        side: "bottom",
        align: "center"
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
          ? "These counts, the path filter, and the source chips control what's shown in the three sections below: Structure Schema Compare, Missing Fields, and Differences — all open by default, so collapse or expand any of them, or this whole summary, with the arrow on the right."
          : "After comparing, this area shows totals, filters, and three collapsible sections — Structure Schema Compare, Missing Fields, and Differences — each open by default and covered next. This summary collapses too, with the arrow on the right. Replay this tour after comparing to see them highlighted.",
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
    },
    {
      element: '[data-tour="about-section"]',
      data: {
        example:
          "Baseline vs Candidate · auto-compare · array modes · ignore paths · Advanced View · exports"
      },
      popover: {
        title: "One place to look it all up again",
        description:
          "This reference at the bottom of the page recaps everything covered here — Baseline and Candidate, auto-compare, ignore paths, Advanced View, and more. Come back to it anytime; you don't need to replay the tour to check a detail.",
        side: "top",
        align: "center"
      }
    }
  ];
}

export function OnboardingTour({
  hasResults,
  settingsRevealed,
  isWorkspaceEmpty,
  onLoadDemoData,
  onRunComparison,
  onExpandResults,
  onClearWorkspace
}: OnboardingTourProps) {
  const tourRef = useRef<Driver | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const hasResultsRef = useRef(hasResults);
  const settingsRevealedRef = useRef(settingsRevealed);
  const isWorkspaceEmptyRef = useRef(isWorkspaceEmpty);
  const onLoadDemoDataRef = useRef(onLoadDemoData);
  const onRunComparisonRef = useRef(onRunComparison);
  const onExpandResultsRef = useRef(onExpandResults);
  const onClearWorkspaceRef = useRef(onClearWorkspace);
  const hasStartedRef = useRef(false);
  /** True once this tour session has filled the panels with its own demo data. */
  const demoInjectedRef = useRef(false);
  /** Guards against a second demo run while one is already animating. */
  const isRunningDemoRef = useRef(false);

  useEffect(() => {
    hasResultsRef.current = hasResults;
    settingsRevealedRef.current = settingsRevealed;
    isWorkspaceEmptyRef.current = isWorkspaceEmpty;
    onLoadDemoDataRef.current = onLoadDemoData;
    onRunComparisonRef.current = onRunComparison;
    onExpandResultsRef.current = onExpandResults;
    onClearWorkspaceRef.current = onClearWorkspace;
  }, [
    hasResults,
    settingsRevealed,
    isWorkspaceEmpty,
    onLoadDemoData,
    onRunComparison,
    onExpandResults,
    onClearWorkspace
  ]);

  /**
   * Announces the demo, loads the pair, pauses so it's visible landing in the panels, runs
   * the real comparison, and waits for it to resolve before advancing — so "Next" out of
   * primary-actions shows highlight-controls, finding-nav, and the results sections
   * happening live instead of jumping straight to description-only fallback text.
   *
   * `resultSteps` are whichever steps of THIS running tour's own steps array have
   * `element === undefined`, built while hasResults was still false — wherever they sit in
   * the array (they don't have to be contiguous or trailing). `resultStepIndexes` records
   * their original positions so the upgrade below can look up each one's real counterpart
   * by index rather than assuming a fixed offset from the end. driver.js reads the steps
   * array by live reference on every navigation, not just once at drive() time, so mutating
   * `.element`/`.popover`/`.data` on these same objects — once real results exist — is
   * enough to make the next navigation highlight the real DOM, with real copy, instead of
   * the no-element fallback.
   */
  const runLiveDemo = useCallback(
    async (
      activeTour: Driver,
      reduceMotion: boolean,
      resultSteps: DriveStep[],
      resultStepIndexes: number[]
    ) => {
      // highlight() re-renders the current popover in place (it doesn't touch step-index
      // navigation state), so the primary-actions target and side/align stay put and only the
      // copy changes — telling the viewer what's about to happen before the panels do.
      activeTour.highlight({
        element: '[data-tour="primary-actions"]',
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
      // The panels now hold the sample pair — narrate what's actually in them (not just that
      // "a sample" loaded) before running the comparison, so the later result steps read as
      // confirmation of something the viewer was already told to expect.
      activeTour.highlight({
        element: '[data-tour="json-inputs"]',
        data: {
          example:
            'Baseline: amount 100, region "eu-west"\nCandidate: amount 150, no region, version "1"'
        },
        popover: {
          title: "A live example, ready to compare",
          description:
            "Baseline and Candidate are filled in: amount changed, region disappeared, and meta.version flipped from a number to a string. Comparing next.",
          side: "bottom",
          align: "center"
        }
      });
      await wait(reduceMotion ? 0 : DEMO_SAMPLE_PAUSE_MS);
      if (!isRunningDemoRef.current) return;
      onRunComparisonRef.current();

      const deadline = Date.now() + DEMO_RESULT_TIMEOUT_MS;
      while (!hasResultsRef.current && Date.now() < deadline) {
        await wait(DEMO_POLL_INTERVAL_MS);
        if (!isRunningDemoRef.current) return;
      }
      if (hasResultsRef.current) {
        // Expand the comparison-output section so the results/result-* steps below highlight
        // real, visible content — settingsRevealedRef stays false here regardless, since the
        // live demo never clicks Advanced View, so array-mode/ignore-paths (also in resultSteps,
        // via the same element===undefined filter) simply stay on their fallback copy; only the
        // hasResults-gated steps actually upgrade.
        onExpandResultsRef.current();
        const liveSteps = buildOnboardingSteps(true, settingsRevealedRef.current);
        resultSteps.forEach((step, index) => {
          const live = liveSteps[resultStepIndexes[index]!];
          if (!live) return;
          step.element = live.element;
          step.popover = { ...step.popover, description: live.popover?.description };
          // The fallback example text becomes redundant once the real thing is on screen —
          // buildOnboardingSteps(true, ...) already omits it, so drop it here too.
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
    // A returning visitor who already has real results skips runLiveDemo entirely (see the
    // hasResultsRef check in onNextClick below) and gets the real results/result-* elements
    // from this very first buildOnboardingSteps call — expand them now so the tour highlights
    // visible content instead of the collapsed section.
    if (hasResultsRef.current) onExpandResultsRef.current();
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const steps = buildOnboardingSteps(hasResultsRef.current, settingsRevealedRef.current);
    // The live demo triggers on primary-actions' own "Next" click, not panel-actions' — it must
    // resolve BEFORE highlight-controls and finding-nav (the next two steps) so a first-time
    // visitor sees those upgraded to their real highlights instead of description-only
    // fallback text. See runLiveDemo and the comment above the highlight-controls step.
    const primaryActionsStep = steps.find(
      (step) => step.element === '[data-tour="primary-actions"]'
    );
    // Steps whose element depends on hasResults (highlight-controls, finding-nav, plus the
    // three result sections) describe results that don't exist yet on a first visit — see
    // runLiveDemo for how they get upgraded to real highlights in place. Found by index
    // rather than a fixed offset from the end, since none of these are contiguous with each
    // other or with the result-section steps.
    const resultStepIndexes = steps
      .map((step, index) => (step.element === undefined ? index : -1))
      .filter((index) => index >= 0);
    const resultSteps = resultStepIndexes.map((index) => steps[index]!);
    if (primaryActionsStep) {
      primaryActionsStep.popover = {
        ...primaryActionsStep.popover,
        onNextClick: (_element, _step, { driver: activeTour }) => {
          if (isRunningDemoRef.current) return;
          if (hasResultsRef.current || !isWorkspaceEmptyRef.current) {
            activeTour.moveNext();
            return;
          }
          isRunningDemoRef.current = true;
          demoInjectedRef.current = true;
          void runLiveDemo(activeTour, reduceMotion, resultSteps, resultStepIndexes);
        }
      };
    }

    const tour = driver({
      steps,
      animate: !reduceMotion,
      smoothScroll: !reduceMotion,
      allowKeyboardControl: true,
      allowScroll: true,
      // A no-op, not "close" or "nextStep": clicking the dimmed overlay must neither dismiss
      // the tour nor skip a step. Only the popover's own close (X) button or "Done" on the
      // last step should end it — allowClose stays at its default so both keep working.
      overlayClickBehavior: () => {},
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
