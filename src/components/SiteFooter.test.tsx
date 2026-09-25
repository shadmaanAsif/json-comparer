import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

afterEach(() => {
  cleanup();
});

describe("SiteFooter", () => {
  it("links to the comparer, about, and docs pages", () => {
    render(<SiteFooter />);

    const nav = screen.getByRole("navigation", { name: "Site" });
    expect(nav.querySelector('a[href="/"]')).toHaveTextContent("Compare");
    expect(nav.querySelector('a[href="/about"]')).toHaveTextContent("About");
    expect(nav.querySelector('a[href="/docs"]')).toHaveTextContent("Documentation");
  });
});
