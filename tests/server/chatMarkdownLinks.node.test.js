import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedChatHref } from "../../src/lib/chatLinkSecurity.js";

describe("frontend chat link allowlist", () => {
  it("matches server rules for internal hash links", () => {
    assert.equal(isAllowedChatHref("#preludematch"), true);
    assert.equal(isAllowedChatHref("https://www.bls.gov/ooh/"), true);
    assert.equal(isAllowedChatHref("#pricing"), true);
  });

  it("rejects javascript URLs", () => {
    assert.equal(isAllowedChatHref("javascript:void(0)"), false);
    assert.equal(isAllowedChatHref("data:text/html,hello"), false);
  });
});
