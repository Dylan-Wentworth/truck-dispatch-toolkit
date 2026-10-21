'use strict';

// Simplified U.S. hours-of-service feasibility check for
// property-carrying drivers (49 CFR 395.3). This is a planning
// estimate, not legal advice. It models the three limits dispatchers
// check most often:
//   - 11-hour driving limit after coming on duty
//   - 14-hour on-duty window
//   - 70-hour / 8-day cycle limit
// plus the 30-minute break required after 8 hours of driving time.
// It does not model split sleeper berth, adverse driving conditions,
// the short-haul exception, or team driving.
//
// Availability inputs default to the legal limits. Pass the driver's
// actual remaining hours when you have them from the ELD.

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(name + ' must be a finite number, got: ' + String(value));
  }
}

// Breaks required: a driver may not drive after 8 cumulative hours of
// driving time without a 30-minute break, so a break is consumed each
// time the driving clock crosses another 8-hour mark before the trip
// ends. Driving exactly 8.0 hours needs no break, 8.5 needs one, 16.0
// needs one (the second mark is the arrival), 16.1 needs two. The
// epsilon keeps exact multiples from rounding up a phantom break.
function breaksNeeded(drivingHours) {
  if (drivingHours <= 0) return 0;
  return Math.floor((drivingHours - 1e-9) / 8);
}

function planTrip({
  distanceMiles,
  averageMph,
  loadingHours = 0,
  unloadingHours = 0,
  driveHoursAvailable = 11,
  shiftHoursAvailable = 14,
  cycleHoursAvailable = 70,
} = {}) {
  const numbers = {
    distanceMiles, averageMph, loadingHours, unloadingHours,
    driveHoursAvailable, shiftHoursAvailable, cycleHoursAvailable,
  };
  for (const [name, value] of Object.entries(numbers)) {
    assertFiniteNumber(value, name);
  }
  if (distanceMiles <= 0) throw new RangeError('distanceMiles must be greater than 0, got: ' + distanceMiles);
  if (averageMph <= 0) throw new RangeError('averageMph must be greater than 0, got: ' + averageMph);
  if (loadingHours < 0) throw new RangeError('loadingHours must be 0 or more, got: ' + loadingHours);
  if (unloadingHours < 0) throw new RangeError('unloadingHours must be 0 or more, got: ' + unloadingHours);
  if (driveHoursAvailable <= 0) throw new RangeError('driveHoursAvailable must be greater than 0');
  if (shiftHoursAvailable <= 0) throw new RangeError('shiftHoursAvailable must be greater than 0');
  if (cycleHoursAvailable <= 0) throw new RangeError('cycleHoursAvailable must be greater than 0');

  const drivingHours = distanceMiles / averageMph;
  const breakCount = breaksNeeded(drivingHours);
  const totalDutyHours = drivingHours + breakCount * 0.5 + loadingHours + unloadingHours;

  // Ordered constraint list. The limiting factor is the constraint with
  // the highest utilisation; order breaks ties in favour of the legal
  // limit, which is the one a dispatcher cannot negotiate with.
  const constraints = [
    { name: '11-hour driving limit', used: drivingHours, limit: 11 },
    { name: 'remaining drive hours', used: drivingHours, limit: driveHoursAvailable },
    { name: '14-hour shift window', used: totalDutyHours, limit: 14 },
    { name: 'remaining shift hours', used: totalDutyHours, limit: shiftHoursAvailable },
    { name: 'remaining cycle hours', used: totalDutyHours, limit: cycleHoursAvailable },
    { name: '70-hour cycle limit', used: totalDutyHours, limit: 70 },
  ];

  const violations = [];
  let limitingFactor = null;
  let highestUse = -1;
  for (const c of constraints) {
    const utilisation = c.used / c.limit;
    if (utilisation > highestUse) {
      highestUse = utilisation;
      limitingFactor = c.name;
    }
    if (c.used > c.limit) {
      violations.push(
        c.name + ' exceeded: needs ' + round2(c.used) + 'h, limit is ' + round2(c.limit) + 'h'
      );
    }
  }

  return {
    feasible: violations.length === 0,
    drivingHours: round2(drivingHours),
    breakCount,
    breakHours: round2(breakCount * 0.5),
    loadingHours,
    unloadingHours,
    totalDutyHours: round2(totalDutyHours),
    violations,
    limitingFactor,
  };
}

// How much of the 70-hour cycle is left, with a plain warning once the
// driver is close to needing a 34-hour restart.
function resetAdvice({ cycleHoursUsed } = {}) {
  assertFiniteNumber(cycleHoursUsed, 'cycleHoursUsed');
  if (cycleHoursUsed < 0) throw new RangeError('cycleHoursUsed must be 0 or more, got: ' + cycleHoursUsed);
  const remainingCycleHours = round2(70 - cycleHoursUsed);
  const warning = remainingCycleHours < 10
    ? 'Under 10 cycle hours left. Plan a 34-hour restart soon; it resets the cycle to a full 70 hours.'
    : null;
  return {
    cycleHoursUsed,
    remainingCycleHours,
    warning,
    restartNote: 'A 34-hour restart (two periods covering 1 a.m. to 5 a.m. are no longer required) restores the full 70-hour cycle.',
  };
}

module.exports = { planTrip, resetAdvice };
