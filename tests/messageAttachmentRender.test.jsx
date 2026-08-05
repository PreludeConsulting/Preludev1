// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import MessageAttachment from "../src/dashboard/components/chat/MessageAttachment.jsx";
import { mapChatMessage } from "../src/lib/chatService.js";

const STORAGE_KEY = "sender-1/thread-a/1754400000000-photo.png";
const SIGNED_URL = `https://proj.supabase.co/storage/v1/object/sign/message-attachments/${STORAGE_KEY}?token=abc`;

const mounted = [];

async function render(message) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(MessageAttachment, { message }));
  });
  mounted.push({ root, container });
  return container;
}

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach(({ root, container }) => {
      root.unmount();
      container.remove();
    });
  });
});

function message(row) {
  return mapChatMessage({ id: "db-1", sender_id: "sender-1", created_at: "2026-08-05T12:00:00.000Z", ...row }, "sender-1");
}

describe("MessageAttachment", () => {
  it("renders nothing when the message has no attachment", async () => {
    const container = await render(message({ body: "hello" }));
    expect(container.innerHTML).toBe("");
  });

  it("renders the image using the signed url, not the filename or key", async () => {
    const container = await render(
      message({ attachment_url: SIGNED_URL, attachment_path: STORAGE_KEY, attachment_name: "photo.png", attachment_mime: "image/png" })
    );

    const img = container.querySelector("img");
    expect(img.getAttribute("src")).toBe(SIGNED_URL);
    expect(img.getAttribute("alt")).toBe("photo.png");
    expect(container.querySelector("a").getAttribute("href")).toBe(SIGNED_URL);
    expect(container.querySelector("a").getAttribute("target")).toBe("_blank");
  });

  it("falls back to a clean card instead of a broken image icon", async () => {
    const container = await render(
      message({ attachment_url: SIGNED_URL, attachment_name: "photo.png", attachment_mime: "image/png" })
    );

    await act(async () => {
      container.querySelector("img").dispatchEvent(new Event("error", { bubbles: false }));
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("photo.png");
  });

  it("renders a file card with name, type, and size for a document", async () => {
    const container = await render(
      message({
        attachment_url: SIGNED_URL,
        attachment_path: STORAGE_KEY,
        attachment_name: "report.pdf",
        attachment_mime: "application/pdf",
        attachment_size: 1048576
      })
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("report.pdf");
    expect(container.textContent).toContain("PDF");
    expect(container.textContent).toContain("1.0 MB");
    expect(container.querySelector("a").getAttribute("href")).toBe(SIGNED_URL);
  });

  it("shows an unavailable card when the url could not be signed", async () => {
    const container = await render(message({ attachment_url: STORAGE_KEY }));

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Unavailable");
    expect(container.innerHTML).not.toContain(STORAGE_KEY);
  });
});
