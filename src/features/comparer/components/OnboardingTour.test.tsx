import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Config } from "driver.js";
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

import { OnboardingTour } from "./OnboardingTour";

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

describe("OnboardingTour", () => {
  it("starts an accessible, keyboard-operable tour of the full workflow", async () => {
    const user = userEvent.setup();
    render(<OnboardingTour hasResults={false} />);

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
      undefined
    ]);
    expect(config.steps?.[2]?.popover?.description).toContain("selected by default");
    expect(config.steps?.[2]?.data?.example).toContain("Default: Unordered");
  });

  it("opens automatically once and remembers when the first tour is dismissed", async () => {
    vi.useFakeTimers();
    const firstVisit = render(<OnboardingTour hasResults={false} />);

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
    expect(window.localStorage.getItem(window.localStorage.key(0)!)).toBe("true");

    firstVisit.unmount();
    driverMock.mockClear();
    driveTour.mockClear();
    render(<OnboardingTour hasResults={false} />);
    act(() => vi.runOnlyPendingTimers());

    expect(driverMock).not.toHaveBeenCalled();
    expect(driveTour).not.toHaveBeenCalled();
  });

  it("still opens for a new user when browser storage is unavailable", () => {
    vi.useFakeTimers();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });

    render(<OnboardingTour hasResults={false} />);
    act(() => vi.runOnlyPendingTimers());

    expect(driveTour).toHaveBeenCalledOnce();
  });

  it("anchors the final guidance to results when a comparison is available", async () => {
    const user = userEvent.setup();
    render(<OnboardingTour hasResults />);

    await user.click(screen.getByRole("button", { name: "Guided tour" }));

    const config = driverMock.mock.calls[0]?.[0] as Config;
    expect(config.steps?.at(-1)?.element).toBe('[data-tour="results"]');
    expect(config.steps?.at(-1)?.popover?.description).toContain("annotated");
  });

  it("turns off tour motion when the user requests reduced motion", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const user = userEvent.setup();
    render(<OnboardingTour hasResults={false} />);

    await user.click(screen.getByRole("button", { name: "Guided tour" }));

    const config = driverMock.mock.calls[0]?.[0] as Config;
    expect(config.animate).toBe(false);
    expect(config.smoothScroll).toBe(false);
  });

  it("adds modal semantics and a specific accessible name to the tour popover", async () => {
    const user = userEvent.setup();
    render(<OnboardingTour hasResults={false} />);
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
    render(<OnboardingTour hasResults={false} />);
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
});
