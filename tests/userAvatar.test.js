import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import UserAvatar from "../src/components/UserAvatar.jsx";

describe("UserAvatar", () => {
  it("renders an uploaded profile photo when avatarUrl is present", () => {
    const html = renderToStaticMarkup(
      React.createElement(UserAvatar, {
        name: "Solomon Cho",
        avatarUrl: "https://cdn.example.com/avatar.jpg",
        size: "md",
        className: "dash-avatar"
      })
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="https://cdn.example.com/avatar.jpg"');
    expect(html).toContain("user-avatar--photo");
    expect(html).toContain("dash-avatar");
  });

  it("falls back to the first initial when no profile photo exists", () => {
    const html = renderToStaticMarkup(React.createElement(UserAvatar, { name: "Solomon Cho", size: "md" }));

    expect(html).toContain("<span");
    expect(html).toContain(">S</span>");
  });
});
