#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  findNextJoinableMeeting,
  isJoinableMeeting,
  isPlaceholderZoomJoinUrl,
  isValidGoogleMeetJoinUrl,
  isValidMeetingJoinUrl,
  isValidZoomJoinUrl,
  preferCalendarItemWithZoom,
  resolveMeetingsForDisplay
} from "../../src/lib/zoomMeetingLinks.js";

function testGoogleMeetValidation() {
  assert.equal(isValidGoogleMeetJoinUrl("https://meet.google.com/abc-defg-hij"), true);
  assert.equal(isValidGoogleMeetJoinUrl("http://meet.google.com/abc-defg-hij"), false);
  assert.equal(isValidGoogleMeetJoinUrl("https://example.com/meet"), false);
  assert.equal(isValidMeetingJoinUrl("https://meet.google.com/abc-defg-hij", "google_meet"), true);
  assert.equal(isValidMeetingJoinUrl("https://zoom.us/j/4242424242", "google_meet"), false);
}

function testJoinableMeeting() {
  assert.equal(isJoinableMeeting({ meetingType: "google_meet", zoomJoinUrl: "https://meet.google.com/abc-defg-hij" }), true);
  assert.equal(isJoinableMeeting({ meetingType: "zoom", zoomJoinUrl: "https://zoom.us/j/4242424242" }), true);
  assert.equal(isJoinableMeeting({ meetingType: "google_meet", zoomJoinUrl: "https://zoom.us/j/4242424242" }), false);
}

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
    { id: "b", zoomJoinUrl: "https://zoom.us/j/888001", meetingType: "zoom" }
  ];
  assert.equal(findNextJoinableMeeting(meetings)?.id, "b");
}

function testPreferCalendarItemWithZoom() {
  const local = { source: "local", zoomJoinUrl: null, title: "Check-in" };
  const meeting = { source: "meeting", zoomJoinUrl: "https://zoom.us/j/888001", title: "Check-in" };
  assert.equal(preferCalendarItemWithZoom(local, meeting).source, "meeting");
}

testGoogleMeetValidation();
testJoinableMeeting();
testPlaceholderDetection();
testResolveMeetingsForDisplay();
testFindNextJoinableMeeting();
testPreferCalendarItemWithZoom();
console.log("zoomMeetingLinks.node.test.js passed");
