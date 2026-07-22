import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("shared modal close button", () => {
  it("centers the close icon in an explicit square control", () => {
    const component = read("src/dashboard/components/ui/index.jsx");
    const styles = read("src/dashboard/dashboard.css");
    const closeStart = styles.indexOf(".dash-modal__close {");
    const closeStyles = styles.slice(closeStart, styles.indexOf(".dash-modal__body {", closeStart));

    expect(component).toContain('className="dash-modal__close"');
    expect(closeStyles).toContain("display: inline-grid");
    expect(closeStyles).toContain("place-items: center");
    expect(closeStyles).toContain("width: var(--control-height)");
    expect(closeStyles).toContain("height: var(--control-height)");
    expect(closeStyles).toContain("padding: 0");
    expect(closeStyles).toContain("line-height: 0");
  });
});
