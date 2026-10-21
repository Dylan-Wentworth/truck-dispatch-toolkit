'use strict';

// Full profit breakdown for a single load.
//
// Driver pay rule: if driverPayPercent is given (greater than 0) it wins
// and is calculated as a percent of linehaul. Otherwise driver pay is
// driverPayPerMile times loaded miles. This mirrors how company drivers
// (percent) and owner-operators leased on per-mile are usually paid.
//
// All money outputs are rounded to 2 decimals. Internal math uses full
// precision and only the returned values are rounded.

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(name + ' must be a finite number, got: ' + String(value));
  }
}

function loadProfit({
  linehaul,
  detentionPay = 0,
  layoverPay = 0,
  tonuPay = 0,
  lumperReimbursed = 0,
  loadedMiles,
  deadheadMiles = 0,
  mpg,
  fuelPricePerGallon,
  factoringPercent = 0,
  tolls = 0,
  driverPayPercent = 0,
  driverPayPerMile = 0,
  lumperCost = 0,
} = {}) {
  const numbers = {
    linehaul, detentionPay, layoverPay, tonuPay, lumperReimbursed,
    loadedMiles, deadheadMiles, mpg, fuelPricePerGallon,
    factoringPercent, tolls, driverPayPercent, driverPayPerMile, lumperCost,
  };
  for (const [name, value] of Object.entries(numbers)) {
    assertFiniteNumber(value, name);
  }
  if (linehaul < 0) throw new RangeError('linehaul must be 0 or more, got: ' + linehaul);
  if (loadedMiles <= 0) throw new RangeError('loadedMiles must be greater than 0, got: ' + loadedMiles);
  if (deadheadMiles < 0) throw new RangeError('deadheadMiles must be 0 or more, got: ' + deadheadMiles);
  if (mpg <= 0) throw new RangeError('mpg must be greater than 0, got: ' + mpg);
  if (fuelPricePerGallon < 0) {
    throw new RangeError('fuelPricePerGallon must be 0 or more, got: ' + fuelPricePerGallon);
  }

  const grossRevenue = linehaul + detentionPay + layoverPay + tonuPay + lumperReimbursed;
  const totalMiles = loadedMiles + deadheadMiles;
  const gallonsUsed = totalMiles / mpg;
  const fuelCost = gallonsUsed * fuelPricePerGallon;
  const factoringCost = grossRevenue * (factoringPercent / 100);
  const driverPay = driverPayPercent > 0
    ? linehaul * (driverPayPercent / 100)
    : driverPayPerMile * loadedMiles;
  const totalCosts = fuelCost + factoringCost + driverPay + tolls + lumperCost;
  const netProfit = grossRevenue - totalCosts;

  return {
    grossRevenue: round2(grossRevenue),
    linehaul: round2(linehaul),
    detentionPay: round2(detentionPay),
    layoverPay: round2(layoverPay),
    tonuPay: round2(tonuPay),
    lumperReimbursed: round2(lumperReimbursed),
    loadedMiles,
    deadheadMiles,
    totalMiles,
    gallonsUsed: round2(gallonsUsed),
    fuelCost: round2(fuelCost),
    factoringCost: round2(factoringCost),
    driverPay: round2(driverPay),
    tolls: round2(tolls),
    lumperCost: round2(lumperCost),
    totalCosts: round2(totalCosts),
    netProfit: round2(netProfit),
    profitPerMile: round2(netProfit / totalMiles),
    marginPercent: grossRevenue > 0 ? round2((netProfit / grossRevenue) * 100) : 0,
  };
}

module.exports = { loadProfit, round2 };
