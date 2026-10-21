'use strict';

// Rate per mile calculations for truck dispatching.
//
// All functions are pure and environment-agnostic (Node or browser).
// Money inputs are dollars, miles are statute miles, percents are points
// (for example, 11.11 means 11.11 percent).

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(name + ' must be a finite number, got: ' + String(value));
  }
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// What a load really pays once the empty (deadhead) miles are counted.
//
// Example: linehaul 2400, loaded 800 mi, deadhead 100 mi.
// Revenue is 2400, the loaded rate is 3.00 per mile, but the true rate
// over all 900 miles driven is 2.67 per mile.
function trueRate({ linehaul, accessorials = 0, loadedMiles, deadheadMiles = 0 } = {}) {
  assertFiniteNumber(linehaul, 'linehaul');
  assertFiniteNumber(accessorials, 'accessorials');
  assertFiniteNumber(loadedMiles, 'loadedMiles');
  assertFiniteNumber(deadheadMiles, 'deadheadMiles');
  if (linehaul < 0) throw new RangeError('linehaul must be 0 or more, got: ' + linehaul);
  if (accessorials < 0) throw new RangeError('accessorials must be 0 or more, got: ' + accessorials);
  if (loadedMiles <= 0) throw new RangeError('loadedMiles must be greater than 0, got: ' + loadedMiles);
  if (deadheadMiles < 0) throw new RangeError('deadheadMiles must be 0 or more, got: ' + deadheadMiles);

  const revenue = linehaul + accessorials;
  const totalMiles = loadedMiles + deadheadMiles;
  return {
    revenue,
    loadedMiles,
    deadheadMiles,
    totalMiles,
    rpmLoaded: revenue / loadedMiles,
    rpmAllMiles: revenue / totalMiles,
    deadheadPercent: round2((deadheadMiles / totalMiles) * 100),
  };
}

// The lowest all-miles rate that covers operating cost plus a target
// margin. The margin is a markup on cost: a cost of 2.00 per mile with
// a 10 percent target margin needs 2.20 per mile.
function breakEven({ costPerMile, targetMarginPercent = 0 } = {}) {
  assertFiniteNumber(costPerMile, 'costPerMile');
  assertFiniteNumber(targetMarginPercent, 'targetMarginPercent');
  if (costPerMile <= 0) throw new RangeError('costPerMile must be greater than 0, got: ' + costPerMile);
  if (targetMarginPercent < 0) {
    throw new RangeError('targetMarginPercent must be 0 or more, got: ' + targetMarginPercent);
  }
  return costPerMile * (1 + targetMarginPercent / 100);
}

// Grades an all-miles rate against the break-even rate.
//   below cost : rpmAllMiles <  breakEven
//   thin       : rpmAllMiles <  breakEven * 1.1
//   fair       : rpmAllMiles <  breakEven * 1.3
//   strong     : anything above that
function rateVerdict({ rpmAllMiles, breakEvenRpm } = {}) {
  assertFiniteNumber(rpmAllMiles, 'rpmAllMiles');
  assertFiniteNumber(breakEvenRpm, 'breakEvenRpm');
  if (rpmAllMiles < 0) throw new RangeError('rpmAllMiles must be 0 or more, got: ' + rpmAllMiles);
  if (breakEvenRpm <= 0) throw new RangeError('breakEvenRpm must be greater than 0, got: ' + breakEvenRpm);

  let verdict;
  if (rpmAllMiles < breakEvenRpm) verdict = 'below cost';
  else if (rpmAllMiles < breakEvenRpm * 1.1) verdict = 'thin';
  else if (rpmAllMiles < breakEvenRpm * 1.3) verdict = 'fair';
  else verdict = 'strong';

  return {
    verdict,
    rpmAllMiles,
    breakEvenRpm,
    spreadPercent: round2(((rpmAllMiles - breakEvenRpm) / breakEvenRpm) * 100),
  };
}

module.exports = { trueRate, breakEven, rateVerdict };
