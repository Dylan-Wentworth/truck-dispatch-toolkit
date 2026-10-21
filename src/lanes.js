'use strict';

// Personal lane rate book.
//
// Load boards show a dispatcher the market's rates; this module keeps
// the rates a dispatcher actually booked. Recording finished loads and
// checking new offers against your own history is the fastest
// protection against lowball offers on lanes you already know.
//
// A lane is an origin state to destination state pair (for example
// TX-OK). Equipment is tracked on every load and can be used as a
// filter, because a reefer average says nothing about dry van money.
//
// A book is a plain object ({ loads: [...] }) so it can be saved as
// JSON anywhere: a file, localStorage, a database row. addLoad mutates
// the book it is given and also returns the stored load.

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(name + ' must be a finite number, got: ' + String(value));
  }
}

function assertBook(book) {
  if (!book || typeof book !== 'object' || !Array.isArray(book.loads)) {
    throw new RangeError('lane book must be an object with a loads array; use createLaneBook()');
  }
}

function normalizeState(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RangeError(name + ' must be a non-empty state code, got: ' + String(value));
  }
  return value.trim().toUpperCase();
}

function normalizeEquipment(value) {
  if (value === undefined || value === null || value === '') return 'dry van';
  if (typeof value !== 'string') {
    throw new RangeError('equipment must be a string, got: ' + String(value));
  }
  return value.trim().toLowerCase();
}

function createLaneBook() {
  return { loads: [] };
}

// Record one booked load. The rate per mile is computed here and stored
// with the load, so stats never re-derive it differently later.
function addLoad(book, { originState, destState, equipment = 'dry van', linehaul, loadedMiles, dateISO } = {}) {
  assertBook(book);
  const origin = normalizeState(originState, 'originState');
  const dest = normalizeState(destState, 'destState');
  const equip = normalizeEquipment(equipment);
  assertFiniteNumber(linehaul, 'linehaul');
  assertFiniteNumber(loadedMiles, 'loadedMiles');
  if (linehaul < 0) throw new RangeError('linehaul must be 0 or more, got: ' + linehaul);
  if (loadedMiles <= 0) throw new RangeError('loadedMiles must be greater than 0, got: ' + loadedMiles);
  if (typeof dateISO !== 'string' || Number.isNaN(new Date(dateISO).getTime())) {
    throw new RangeError('dateISO must be a valid date string, got: ' + String(dateISO));
  }

  const load = {
    lane: origin + '-' + dest,
    originState: origin,
    destState: dest,
    equipment: equip,
    linehaul,
    loadedMiles,
    rpm: linehaul / loadedMiles,
    dateISO,
  };
  book.loads.push(load);
  return load;
}

function laneLoads(book, { originState, destState, equipment } = {}) {
  assertBook(book);
  const lane = normalizeState(originState, 'originState') + '-' + normalizeState(destState, 'destState');
  const equip = equipment === undefined ? null : normalizeEquipment(equipment);
  return book.loads.filter((load) => load.lane === lane && (equip === null || load.equipment === equip));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function rawStats(loads) {
  const rpms = loads.map((load) => load.rpm);
  const totalLinehaul = loads.reduce((sum, load) => sum + load.linehaul, 0);
  const last = loads.reduce((a, b) => (new Date(a.dateISO) >= new Date(b.dateISO) ? a : b));
  return {
    count: loads.length,
    avgRpm: rpms.reduce((a, b) => a + b, 0) / rpms.length,
    medianRpm: median(rpms),
    minRpm: Math.min(...rpms),
    maxRpm: Math.max(...rpms),
    avgLinehaul: totalLinehaul / loads.length,
    lastDateISO: last.dateISO,
  };
}

// Summary of what a lane has actually paid. Returns null when the book
// has no loads on the lane (after the equipment filter, if given):
// no history is a different answer from a zero average.
function laneStats(book, { originState, destState, equipment } = {}) {
  const loads = laneLoads(book, { originState, destState, equipment });
  if (loads.length === 0) return null;
  const s = rawStats(loads);
  return {
    lane: loads[0].lane,
    equipment: equipment === undefined ? null : normalizeEquipment(equipment),
    count: s.count,
    avgRpm: round4(s.avgRpm),
    medianRpm: round4(s.medianRpm),
    minRpm: round4(s.minRpm),
    maxRpm: round4(s.maxRpm),
    avgLinehaul: round2(s.avgLinehaul),
    lastDateISO: s.lastDateISO,
  };
}

// Judge a new offer against your own booked history on the lane.
// One load is an anecdote, so judging starts at 2 loads; below that
// the verdict is 'insufficient history' and no counter is suggested.
//
// Counter tactics, the way dispatchers actually run them:
//   - a fair-but-soft offer (within 10 percent under your average)
//     gets countered at your average,
//   - a lowball (more than 10 percent under) gets countered at your
//     average plus 10 percent, leaving room to settle at the average.
function rateGuard(book, { originState, destState, equipment, offeredLinehaul, loadedMiles } = {}) {
  assertFiniteNumber(offeredLinehaul, 'offeredLinehaul');
  assertFiniteNumber(loadedMiles, 'loadedMiles');
  if (offeredLinehaul < 0) throw new RangeError('offeredLinehaul must be 0 or more, got: ' + offeredLinehaul);
  if (loadedMiles <= 0) throw new RangeError('loadedMiles must be greater than 0, got: ' + loadedMiles);

  const loads = laneLoads(book, { originState, destState, equipment });
  const lane = normalizeState(originState, 'originState') + '-' + normalizeState(destState, 'destState');
  if (loads.length < 2) {
    return { verdict: 'insufficient history', sampleSize: loads.length, lane };
  }

  const { avgRpm } = rawStats(loads);
  const offeredRpm = offeredLinehaul / loadedMiles;
  const percentDiff = round2(((offeredRpm - avgRpm) / avgRpm) * 100);
  const base = {
    sampleSize: loads.length,
    lane,
    offeredRpm: round4(offeredRpm),
    avgRpm: round4(avgRpm),
    percentDiff,
  };

  if (offeredRpm >= avgRpm) {
    return { ...base, verdict: 'at or above your average' };
  }
  if (offeredRpm >= avgRpm * 0.9) {
    return { ...base, verdict: 'below average, counter suggested', suggestedCounter: round2(avgRpm * loadedMiles) };
  }
  return {
    ...base,
    verdict: 'lowball',
    suggestedCounter: round2(avgRpm * 1.1 * loadedMiles),
    percentBelow: round2(((avgRpm - offeredRpm) / avgRpm) * 100),
  };
}

// Per-equipment rollup across the whole book: how many loads of each
// type you run, and what they pay on average.
function equipmentBreakdown(book) {
  assertBook(book);
  const byEquipment = {};
  for (const load of book.loads) {
    if (!byEquipment[load.equipment]) byEquipment[load.equipment] = { count: 0, rpmTotal: 0 };
    byEquipment[load.equipment].count += 1;
    byEquipment[load.equipment].rpmTotal += load.rpm;
  }
  const out = {};
  for (const [equipment, agg] of Object.entries(byEquipment)) {
    out[equipment] = { count: agg.count, avgRpm: round4(agg.rpmTotal / agg.count) };
  }
  return out;
}

// Serialize a book to a JSON string for storage anywhere.
function toJSON(book) {
  assertBook(book);
  return JSON.stringify({ loads: book.loads }, null, 2);
}

// Restore a book from toJSON output (a string, or an already-parsed
// object). Every load is rebuilt through addLoad, which validates the
// shape and recomputes the rpm from linehaul and miles rather than
// trusting whatever was stored.
function fromJSON(json) {
  let parsed = json;
  if (typeof json === 'string') {
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      throw new RangeError('lane book JSON could not be parsed: ' + err.message);
    }
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.loads)) {
    throw new RangeError('lane book JSON must be an object with a loads array');
  }
  const book = createLaneBook();
  for (const entry of parsed.loads) {
    addLoad(book, entry);
  }
  return book;
}

module.exports = { createLaneBook, addLoad, laneStats, rateGuard, equipmentBreakdown, toJSON, fromJSON };
