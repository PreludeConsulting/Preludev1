import { describe, expect, it } from "vitest";
import {
  NETWORK_STAT_SAFE_ZONES,
  buildCalloutSlot,
  estimateCalloutTypingMs,
  pickCalloutZone,
  positionInZone
} from "../src/lib/networkStatCallouts.js";

describe("networkStatCallouts", () => {
  it("defines multiple safe overlay zones", () => {
    expect(NETWORK_STAT_SAFE_ZONES.length).toBeGreaterThanOrEqual(3);
  });

  it("pickCalloutZone avoids repeating the previous zone when possible", () => {
    for (let i = 0; i < 20; i += 1) {
      const next = pickCalloutZone(2, NETWORK_STAT_SAFE_ZONES);
      expect(next).not.toBe(2);
    }
  });

  it("positionInZone stays inside the zone bounds", () => {
    const zone = NETWORK_STAT_SAFE_ZONES[0];
    let i = 0;
    const random = () => {
      i += 1;
      return (i % 10) / 10;
    };

    const pos = positionInZone(zone, random);
    const left = Number.parseFloat(pos.left);
    const top = Number.parseFloat(pos.top);

    expect(left).toBeGreaterThanOrEqual(zone.left);
    expect(left).toBeLessThanOrEqual(zone.left + zone.width);
    expect(top).toBeGreaterThanOrEqual(zone.top);
    expect(top).toBeLessThanOrEqual(zone.top + zone.height);
  });

  it("buildCalloutSlot cycles stats and moves zones", () => {
    const first = buildCalloutSlot(0, -1, () => 0.2);
    const second = buildCalloutSlot(1, first.zoneIndex, () => 0.8);

    expect(first.statIndex).toBe(0);
    expect(second.statIndex).toBe(1);
    expect(second.zoneIndex).not.toBe(first.zoneIndex);
  });

  it("safe zones stay in the upper/middle map area", () => {
    for (const zone of NETWORK_STAT_SAFE_ZONES) {
      expect(zone.top + zone.height).toBeLessThanOrEqual(56);
      expect(zone.left + zone.width).toBeLessThanOrEqual(90);
    }
  });

  it("estimateCalloutTypingMs scales with word count", () => {
    const row = { value: "25+", title: "Universities", description: "Represented across the network." };
    expect(estimateCalloutTypingMs(row)).toBeGreaterThan(200);
  });
});
