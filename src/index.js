'use strict';

// truck-dispatch-toolkit
// Calculation library for U.S. truck dispatchers and owner-operators.
// Zero dependencies. Every function is pure and environment-agnostic.

const rates = require('./rates');
const profit = require('./profit');
const hos = require('./hos');
const detention = require('./detention');
const ifta = require('./ifta');

module.exports = {
  // Namespaced access: toolkit.rates.trueRate(...)
  rates,
  profit,
  hos,
  detention,
  ifta,
  // Flat access: toolkit.trueRate(...)
  trueRate: rates.trueRate,
  breakEven: rates.breakEven,
  rateVerdict: rates.rateVerdict,
  loadProfit: profit.loadProfit,
  planTrip: hos.planTrip,
  resetAdvice: hos.resetAdvice,
  detentionCharge: detention.detentionCharge,
  claimLetter: detention.claimLetter,
  gallonsByState: ifta.gallonsByState,
  taxEstimate: ifta.taxEstimate,
  IFTA_DEFAULT_RATES: ifta.DEFAULT_RATES,
};
