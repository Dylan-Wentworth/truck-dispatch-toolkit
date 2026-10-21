'use strict';

// IFTA (International Fuel Tax Agreement) planning estimates.
//
// IMPORTANT: IFTA tax rates change every quarter and are published by
// each jurisdiction. The DEFAULT_RATES table below holds approximate
// 2025 rates per gallon for a handful of states so estimates and tests
// can run offline. Always verify the current quarter's rates at
// ifta.org or your base jurisdiction's IFTA rate sheet before filing.
//
// Oregon note: Oregon has no IFTA fuel tax. Carriers pay a weight-mile
// tax instead, administered separately by ODOT. OR is listed at 0.00
// here so Oregon miles are counted for gallons but add no fuel tax;
// that is deliberate, not missing data.
//
// The real IFTA formula credits tax paid at the pump in each state
// against tax owed for miles driven in each state. This module only
// estimates the owed side (miles x rate per gallon via fleet MPG),
// which is the number dispatchers use for lane costing and surcharge
// planning. It is an estimate, not a tax filing.

const DEFAULT_RATES = {
  TX: 0.20,
  OK: 0.20,
  NM: 0.17,
  AZ: 0.26,
  CA: 0.439,
  FL: 0.352,
  GA: 0.323,
  NC: 0.403,
  PA: 0.741,
  OH: 0.385,
  IN: 0.55,
  IL: 0.529,
  OR: 0.0, // no fuel tax; weight-mile tax instead, see note above
};

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normaliseMiles(milesByState, mpg) {
  if (typeof mpg !== 'number' || !Number.isFinite(mpg) || mpg <= 0) {
    throw new RangeError('mpg must be a finite number greater than 0, got: ' + String(mpg));
  }
  if (milesByState === null || typeof milesByState !== 'object') {
    throw new RangeError('milesByState must be an object like { TX: 500, OK: 200 }');
  }
  const out = {};
  for (const [rawState, miles] of Object.entries(milesByState)) {
    const state = rawState.toUpperCase();
    if (typeof miles !== 'number' || !Number.isFinite(miles) || miles < 0) {
      throw new RangeError('miles for ' + state + ' must be a finite number of 0 or more, got: ' + String(miles));
    }
    out[state] = (out[state] || 0) + miles;
  }
  return out;
}

// Splits fuel consumption across states: each state's gallons are its
// miles divided by the fleet MPG, the standard IFTA apportionment.
function gallonsByState({ milesByState, mpg } = {}) {
  const miles = normaliseMiles(milesByState, mpg);
  const byState = {};
  let totalMiles = 0;
  let totalGallons = 0;
  for (const [state, stateMiles] of Object.entries(miles)) {
    const gallons = round2(stateMiles / mpg);
    byState[state] = { miles: stateMiles, gallons };
    totalMiles += stateMiles;
    totalGallons += gallons;
  }
  return { byState, totalMiles, totalGallons: round2(totalGallons) };
}

// Estimates tax owed per state: gallons consumed in the state times
// that state's per-gallon rate. Pass your own taxRates map to override
// DEFAULT_RATES. States with no rate available are reported in the
// unrated array (with their gallons) instead of throwing, so a partial
// estimate is still useful.
function taxEstimate({ milesByState, mpg, taxRates = DEFAULT_RATES } = {}) {
  const miles = normaliseMiles(milesByState, mpg);
  const rates = {};
  for (const [rawState, rate] of Object.entries(taxRates || {})) {
    rates[rawState.toUpperCase()] = rate;
  }
  const byState = {};
  const unrated = [];
  let totalTax = 0;
  for (const [state, stateMiles] of Object.entries(miles)) {
    const gallonsRaw = stateMiles / mpg;
    const gallons = round2(gallonsRaw);
    if (!(state in rates)) {
      byState[state] = { miles: stateMiles, gallons, taxRate: null, tax: null };
      unrated.push(state);
      continue;
    }
    const tax = round2(gallonsRaw * rates[state]);
    byState[state] = { miles: stateMiles, gallons, taxRate: rates[state], tax };
    totalTax += tax;
  }
  return { byState, totalTax: round2(totalTax), unrated };
}

module.exports = { gallonsByState, taxEstimate, DEFAULT_RATES };
