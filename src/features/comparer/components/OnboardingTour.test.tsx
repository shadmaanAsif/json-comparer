import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Config, DriveStep } from "driver.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const { destroyTour, driveTour, driverMock } = vi.hoisted(() => ({
  destroyTour: vi.fn(),
  driveTour: vi.fn(),
  driverMock: vi.fn()
}));

vi.mock("driver.js", () => ({
  driver: driverMock.mockImplementation(() => ({
    destroy: destroyTour,
    drive: driveTour
  }))
}));

import { OnboardingTour, type OnboardingTourProps } from "./OnboardingTour";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  destroyTour.mockClear();
  driveTour.mockClear();
  driverMock.mockClear();
});

function renderTour(overrides: Partial<OnboardingTourProps> = {}) {
  const props: OnboardingTourProps = {
    hasResults: false,
    isWorkspaceEmpty: true,
    onLoadDemoData: vi.fn(),
    onRunComparison: vi.fn(),
    onClearWorkspace: vi.fn(),
    isDifferencesExpanded: false,
    onSetDifferencesExpanded: vi.fn(),
    ...overrides
  };
  return { ...render(<OnboardingTour {...props} />), props };
}

function findStep(config: Config, selector: string): DriveStep {
  const step = config.steps?.find((candidate) => candidate.element === selector);
  if (!step) throw new Error(`Step ${selector} not found`);
  return step;
}

describe("OnboardingTour", () => {
  it("starts an accessible, keyboard-operable tour of the full workflow", async () => {
    const user = userEvent.setup();
    renderTour();

    const launcher = screen.getByRole("button", { name: "Guided tour" });
    expect(launcher).toHaveAttribute("aria-haspopup", "dialog");

    await user.click(launcher);

    expect(driverMock).toHaveBeenCalledOnce();
    expect(driveTour).toHaveBeenCalledOnce();
    const config = driverMock.mock.calls[0]?.[0] as Config;
    expect(config.allowKeyboardControl).toBe(true);
    expect(config.disableActiveInteraction).toBe(true);
    expect(config.showProgress).toBe(true);
    expect(config.steps?.every((step) => typeof step.data?.example === "string")).toBe(true);
    expect(config.steps?.map((step) => step.element)).toEqual([
      '[data-tour="privacy"]',
      '[data-tour="json-inputs"]',
      '[data-tour="array-mode"]',
      '[data-tour="ignore-paths"]',
      '[data-tour="highlight-controls"]',
      '[data-tour="primary-actions"]',
      '[data-tour="panel-actions"]',
      undefined,
      undefined,
      undefined,
      undefined
    ]);
    expect(config.steps?.[2]?.popover?.description).toContain("selected by default");
    expect(config.steps?.[2]?.data?.example).toContain("Default: Ordered");
    expect(config.steps?.[6]?.popover?.description).toContain("Shift+F10");
    expect(config.steps?.[6]?.data?.example).toContain("Copy value");
  });

  it("opens automatically once and remembers when the first tour is dismissed", async () => {
    vi.useFakeTimers();
    const firstVisit = renderTour();

    act(() => vi.runOnlyPendingTimers());

    expect(driverMock).toHaveBeenCalledOnce();
    expect(driveTour).toHaveBeenCalledOnce();
    const firstConfig = driverMock.mock.calls[0]?.[0] as Config;
    act(() => {
      firstConfig.onDestroyStarted?.(
        undefined,
        {} as never,
        { driver: { destroy: destroyTour } } as never
      );
    });
    await Promise.resolve();
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.getItem(window.localStorage.key(0)!)).toBeTruthy();

    firstVisit.unmount();
    driverMock.mockClear();
    driveTour.mockClear();
    renderTour();
    act(() => vi.runOnlyPendingTimers());

    expect(driverMock).not.toHaveBeenCalled();
    expect(driveTour).not.toHaveBeenCalled();
  });

  it("removes legacy per-version 'seen' keys from the old scheme, without touching unrelated storage", () => {
    window.localStorage.setItem("json-comparer:onboarding-tour-seen:v1", "true");
    window.localStorage.setItem("json-comparer:onboarding-tour-seen:v2", "true");
    window.localStorage.setItem("some-other-app:setting", "keep me");

    renderTour();

    expect(window.localStorage.getItem("json-comparer:onboarding-tour-seen:v1")).toBeNull();
    expect(window.localStorage.getItem("json-comparer:onboarding-tour-seen:v2")).toBeNull();
    expect(window.localStorage.getItem("some-other-app:setting")).toBe("keep me");
  });

  it("still opens for a new user when browser storage is unavailable", () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });

    renderTour();
    act(() => vi.runOnlyPendingTimers());

    expect(driveTour).toHaveBeenCalledOnce();
  });

  it("anchors the results overview and each result section when a comparison is available", async () => {
    const user = userEvent.setup();
    renderTour({ hasResults: true, isWorkspaceEmpty: false });

    await user.click(screen.getByRole("button", { name: "Guided tour" }));

    const config = driverMock.mock.calls[0]?.[0] as Config;
    expect(config.steps?.slice(-4).map((step) => step.element)).toEqual([
      '[data-tour="results"]',
      '[data-tour="result-structure"]',
      '[data-tour="result-missing"]',
      '[data-tour="result-differences"]'
    ]);
    expect(config.steps?.at(-3)?.popover?.description).toContain("structurally missing");
    expect(config.steps?.at(-2)?.popover?.description).toContain("review note");
    expect(config.steps?.at(-1)?.popover?.description).toContain("Baseline and Candidate values");
  });

  it("turns off tour motion when the user requests reduced motion", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const user = userEvent.setup();
    renderTour();

    await user.click(screen.getByRole("button", { name: "Guided tour" }));

    const config = driverMock.mock.calls[0]?.[0] as Config;
    expect(config.animate).toBe(false);
    expect(config.smoothScroll).toBe(false);
  });

  it("adds modal semantics and a specific accessible name to the tour popover", async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(screen.getByRole("button", { name: "Guided tour" }));

    const config = driverMock.mock.calls[0]?.[0] as Config;
    const wrapper = document.createElement("div");
    const closeButton = document.createElement("button");
    const description = document.createElement("div");
    wrapper.append(description);
    config.onPopoverRender?.(
      {
        wrapper,
        closeButton,
        arrow: document.createElement("div"),
        title: document.createElement("div"),
        description,
        footer: document.createElement("div"),
        progress: document.createElement("div"),
        previousButton: document.createElement("button"),
        nextButton: document.createElement("button"),
        footerButtons: document.createElement("div")
      },
      { state: { activeStep: config.steps?.[0] } } as never
    );

    expect(wrapper).toHaveAttribute("aria-modal", "true");
    expect(closeButton).toHaveAccessibleName("Exit guided tour");
    expect(wrapper).toHaveTextContent("Example");
    expect(wrapper.querySelector("code")).toHaveTextContent("compared locally");
  });

  it("restores focus to the launcher when the tour closes", async () => {
    const user = userEvent.setup();
    renderTour();
    const launcher = screen.getByRole("button", { name: "Guided tour" });
    await user.click(launcher);
    launcher.blur();

    const config = driverMock.mock.calls[0]?.[0] as Config;
    config.onDestroyStarted?.(
      undefined,
      {} as never,
      { driver: { destroy: destroyTour } } as never
    );
    await Promise.resolve();

    expect(destroyTour).toHaveBeenCalledOnce();
    expect(launcher).toHaveFocus();
  });

  describe("live demo on an empty, first-time workspace", () => {
    it("loads a demo, runs the real comparison, and upgrades the results steps to real highlights once it resolves", async () => {
      const onLoadDemoData = vi.fn();
      const onRunComparison = vi.fn();
      const user = userEvent.setup();
      const { rerender, props } = renderTour({ onLoadDemoData, onRunComparison });

      await user.click(screen.getByRole("button", { name: "Guided tour" }));
      const config = driverMock.mock.calls[0]?.[0] as Config;
      const panelActionsStep = findStep(config, '[data-tour="panel-actions"]');
      const moveNext = vi.fn();

      // Fake timers only from here — the click above needs real ones for userEvent.
      vi.useFakeTimers();
      panelActionsStep.popover?.onNextClick?.(undefined, panelActionsStep, {
        driver: { moveNext, highlight: vi.fn() } as never
      } as never);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(onLoadDemoData).toHaveBeenCalledOnce();
      expect(onRunComparison).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(700);
      });
      expect(onRunComparison).toHaveBeenCalledOnce();
      expect(moveNext).not.toHaveBeenCalled();

      // The parent finishes its (mocked) comparison and reports real results.
      rerender(<OnboardingTour {...props} hasResults />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(moveNext).toHaveBeenCalledOnce();
      expect(config.steps?.slice(-4).map((step) => step.element)).toEqual([
        '[data-tour="results"]',
        '[data-tour="result-structure"]',
        '[data-tour="result-missing"]',
        '[data-tour="result-differences"]'
      ]);
      // The canned example text is redundant once the real thing is highlighted behind the
      // popover, so it should be cleared along with the element/description upgrade.
      expect(config.steps?.slice(-4).every((step) => step.data?.example === undefined)).toBe(true);
    });

    it("never loads a demo over the user's own typed input or an existing comparison", async () => {
      const user = userEvent.setup();
      const onLoadDemoData = vi.fn();
      const onRunComparison = vi.fn();
      renderTour({ isWorkspaceEmpty: false, onLoadDemoData, onRunComparison });

      await user.click(screen.getByRole("button", { name: "Guided tour" }));
      const config = driverMock.mock.calls[0]?.[0] as Config;
      const panelActionsStep = findStep(config, '[data-tour="panel-actions"]');
      const moveNext = vi.fn();

      panelActionsStep.popover?.onNextClick?.(undefined, panelActionsStep, {
        driver: { moveNext } as never
      } as never);

      expect(onLoadDemoData).not.toHaveBeenCalled();
      expect(onRunComparison).not.toHaveBeenCalled();
      expect(moveNext).toHaveBeenCalledOnce();
    });

    it("clears the demo it introduced when the tour ends, but leaves real results untouched", async () => {
      const user = userEvent.setup();
      const onClearWorkspace = vi.fn();
      renderTour({ onClearWorkspace });

      await user.click(screen.getByRole("button", { name: "Guided tour" }));
      const config = driverMock.mock.calls[0]?.[0] as Config;
      const panelActionsStep = findStep(config, '[data-tour="panel-actions"]');
      panelActionsStep.popover?.onNextClick?.(undefined, panelActionsStep, {
        driver: { moveNext: vi.fn(), highlight: vi.fn() } as never
      } as never);

      config.onDestroyStarted?.(
        undefined,
        {} as never,
        { driver: { destroy: destroyTour } } as never
      );

      expect(onClearWorkspace).toHaveBeenCalledOnce();
    });

    it("does not clear the workspace on close when the tour never introduced a demo", async () => {
      const user = userEvent.setup();
      const onClearWorkspace = vi.fn();
      renderTour({ hasResults: true, isWorkspaceEmpty: false, onClearWorkspace });

      await user.click(screen.getByRole("button", { name: "Guided tour" }));
      const config = driverMock.mock.calls[0]?.[0] as Config;

      config.onDestroyStarted?.(
        undefined,
        {} as never,
        { driver: { destroy: destroyTour } } as never
      );

      expect(onClearWorkspace).not.toHaveBeenCalled();
    });
  });

  describe("Differences section expansion", () => {
    it("expands Differences only while its step is active, then restores it on deselection", async () => {
      const onSetDifferencesExpanded = vi.fn();
      const user = userEvent.setup();
      renderTour({
        hasResults: true,
        isWorkspaceEmpty: false,
        isDifferencesExpanded: false,
        onSetDifferencesExpanded
      });

      await user.click(screen.getByRole("button", { name: "Guided tour" }));
      const config = driverMock.mock.calls[0]?.[0] as Config;
      const differencesStep = findStep(config, '[data-tour="result-differences"]');

      config.onHighlightStarted?.(undefined, differencesStep, {} as never);
      expect(onSetDifferencesExpanded).toHaveBeenCalledOnce();
      expect(onSetDifferencesExpanded).toHaveBeenCalledWith(true);

      config.onDeselected?.(undefined, differencesStep, {} as never);
      expect(onSetDifferencesExpanded).toHaveBeenLastCalledWith(false);
    });

    it("leaves Differences alone if it was already expanded before the tour reached that step", async () => {
      const onSetDifferencesExpanded = vi.fn();
      const user = userEvent.setup();
      renderTour({
        hasResults: true,
        isWorkspaceEmpty: false,
        isDifferencesExpanded: true,
        onSetDifferencesExpanded
      });

      await user.click(screen.getByRole("button", { name: "Guided tour" }));
      const config = driverMock.mock.calls[0]?.[0] as Config;
      const differencesStep = findStep(config, '[data-tour="result-differences"]');

      config.onHighlightStarted?.(undefined, differencesStep, {} as never);
      config.onDeselected?.(undefined, differencesStep, {} as never);

      expect(onSetDifferencesExpanded).not.toHaveBeenCalled();
    });

    it("ignores highlight/deselect events for every other step", async () => {
      const onSetDifferencesExpanded = vi.fn();
      const user = userEvent.setup();
      renderTour({ hasResults: true, isWorkspaceEmpty: false, onSetDifferencesExpanded });

      await user.click(screen.getByRole("button", { name: "Guided tour" }));
      const config = driverMock.mock.calls[0]?.[0] as Config;
      const otherStep = findStep(config, '[data-tour="result-missing"]');

      config.onHighlightStarted?.(undefined, otherStep, {} as never);
      config.onDeselected?.(undefined, otherStep, {} as never);

      expect(onSetDifferencesExpanded).not.toHaveBeenCalled();
    });
  });
});
