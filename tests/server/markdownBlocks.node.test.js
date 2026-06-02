import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChatMarkdownBlocks } from "../../src/lib/chatMarkdown.js";

describe("chat markdown parsing", () => {
  it("parses headings and bullet lists", () => {
    const blocks = parseChatMarkdownBlocks(
      "## Georgia Tech vs. UGA\n\n**Georgia Tech**\n- Strong fit for engineering\n- Location: Atlanta"
    );
    assert.equal(blocks[0].type, "heading");
    assert.equal(blocks[1].type, "paragraph");
    assert.equal(blocks[2].type, "ul");
    assert.equal(blocks[2].items.length, 2);
  });

  it("does not treat raw html as blocks", () => {
    const blocks = parseChatMarkdownBlocks("Hello <script>alert(1)</script>");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "paragraph");
    assert.match(blocks[0].text, /<script>/);
  });
});
