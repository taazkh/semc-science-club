import assert from "node:assert/strict";
import test from "node:test";
import {
  festivalOpening,
  remainingFestivalTime,
} from "../src/components/festival-countdown";

const opening = Date.parse("2026-11-16T02:00:00Z");
const complete = { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };

test("8 AM Dhaka opening is 2 AM UTC with one second left immediately before it", () => {
  assert.equal(Date.parse(festivalOpening), opening);
  const lastSecond = { days: 0, hours: 0, minutes: 0, seconds: 1, total: 1 };
  assert.deepEqual(
    remainingFestivalTime(Date.parse("2026-11-16T01:59:59Z")),
    lastSecond,
  );
  assert.deepEqual(
    remainingFestivalTime(Date.parse("2026-11-16T07:59:59+06:00")),
    lastSecond,
  );
  assert.deepEqual(remainingFestivalTime(opening), complete);
  assert.deepEqual(
    remainingFestivalTime(Date.parse("2026-11-16T08:00:00+06:00")),
    complete,
  );
});

test("a fractional final second never marks opening early", () => {
  assert.deepEqual(remainingFestivalTime(opening - 1), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 1,
    total: 1,
  });
  assert.deepEqual(remainingFestivalTime(opening + 1), complete);
});

test("elapsed opening times clamp every countdown unit to zero", () => {
  for (const now of [opening + 1000, opening + 86400000, opening + 31536000000])
    assert.deepEqual(remainingFestivalTime(now), complete);
});

test("countdown carries cleanly between days, hours, minutes and seconds", () => {
  const cases = [
    { days: 1, hours: 1, minutes: 0, seconds: 0, total: 90000 },
    { days: 1, hours: 0, minutes: 0, seconds: 0, total: 86400 },
    { days: 0, hours: 23, minutes: 59, seconds: 59, total: 86399 },
    { days: 0, hours: 1, minutes: 0, seconds: 0, total: 3600 },
    { days: 0, hours: 0, minutes: 59, seconds: 59, total: 3599 },
    { days: 0, hours: 0, minutes: 1, seconds: 0, total: 60 },
    { days: 0, hours: 0, minutes: 0, seconds: 59, total: 59 },
  ];
  for (const expected of cases)
    assert.deepEqual(
      remainingFestivalTime(opening - expected.total * 1000),
      expected,
    );
});

test("fresh timestamps catch up after a clock jump or a suspended page", () => {
  assert.deepEqual(remainingFestivalTime(Date.parse("2026-11-14T02:00:00Z")), {
    days: 2,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 172800,
  });
  assert.deepEqual(remainingFestivalTime(Date.parse("2026-11-15T23:59:58Z")), {
    days: 0,
    hours: 2,
    minutes: 0,
    seconds: 2,
    total: 7202,
  });
  assert.deepEqual(
    remainingFestivalTime(Date.parse("2026-11-16T02:00:45Z")),
    complete,
  );
  assert.deepEqual(remainingFestivalTime(Date.parse("2026-11-16T01:59:59Z")), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 1,
    total: 1,
  });
});
