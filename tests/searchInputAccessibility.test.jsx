// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SearchInput } from "../src/dashboard/components/ui/index.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;

afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("SearchInput accessibility", () => {
  it("derives an accessible name from its visible prompt", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root.render(<SearchInput value="" onChange={() => {}} placeholder="Search mentors…" />);
    });

    expect(host.querySelector('input[type="search"]')?.getAttribute("aria-label")).toBe("Search mentors…");
  });

  it("accepts a more specific accessible name", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    act(() => {
      root.render(<SearchInput value="" onChange={() => {}} placeholder="Search…" ariaLabel="Search saved colleges" />);
    });

    expect(host.querySelector('input[type="search"]')?.getAttribute("aria-label")).toBe("Search saved colleges");
  });
});
