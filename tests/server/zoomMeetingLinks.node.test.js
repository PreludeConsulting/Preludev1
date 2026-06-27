#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  findNextJoinableMeeting,
  isPlaceholderZoomJoinUrl,
  isValidZoomJoinUrl,
  preferCalendarItemWithZoom,
  resolveMeetingsForDisplay
} from "../../src/lib/zoomMeetingLinks.js";

function testPlaceholderDetection() {
  assert.equal(isPlaceholderZoomJoinUrl("https://zoom.us/j/1234567890"), true);
  assert.equal(isValidZoomJoinUrl("https://zoom.us/j/4242424242"), true);
  assert.equal(isValidZoomJoinUrl("https://zoom.us/j/1234567890"), false);
  assert.equal(isValidZoomJoinUrl("http://zoom.us/j/123"), false);
  assert.equal(isValidZoomJoinUrl("https://example.com/j/123"), false);
}

function testResolveMeetingsForDisplay() {
  const demo = [{ id: "demo-1", status: "scheduled", zoomJoinUrl: "https://zoom.us/j/1234567890" }];
  const api = [{ id: "real-1", status: "scheduled", zoomJoinUrl: "https://zoom.us/j/555001" }];

  assert.deepEqual(resolveMeetingsForDisplay(api, demo).map((m) => m.id), ["real-1"]);
  assert.deepEqual(resolveMeetingsForDisplay([], demo), []);
}

function testFindNextJoinableMeeting() {
  const meetings = [
    { id: "a", zoomJoinUrl: "https://zoom.us/j/1234567890" },
    { id: "b", zoomJoinUrl: "https://zoom.us/j/888001" }
  ];
  assert.equal(findNextJoinableMeeting(meetings)?.id, "b");
}

function testPreferCalendarItemWithZoom() {
  const local = { source: "local", zoomJoinUrl: null, title: "Check-in" };
  const meeting = { source: "meeting", zoomJoinUrl: "https://zoom.us/j/888001", title: "Check-in" };
  assert.equal(preferCalendarItemWithZoom(local, meeting).source, "meeting");
}

testPlaceholderDetection();
testResolveMeetingsForDisplay();
testFindNextJoinableMeeting();
testPreferCalendarItemWithZoom();
console.log("zoomMeetingLinks.node.test.js passed");
