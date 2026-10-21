'use strict';

// Broker payment scorecard, built from your own invoice history.
//
// Factoring companies and credit services grade brokers on everyone's
// data. This grades a broker on the only data that decides whether
// YOU got paid on time: the invoices you sent them. Feed it the
// amounts and the days each one took to pay, and it returns a letter
// grade, the behaviour behind it, and a plain booking recommendation.
//
// Averages and medians use paid invoices only; unpaid invoices are
// counted separately as outstanding money and flagged, because one
// broker can pay 20 invoices on time and still be sitting on yours.

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(name + ' must be a finite number, got: ' + String(value));
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

const RECOMMENDATIONS = {
  A: 'Safe to book, standard terms',
  B: 'Book, watch payment on first loads',
  C: 'Factor invoices or require quick-pay',
  D: 'Quick-pay or fuel advance only',
  F: 'Avoid or require payment upfront',
};

function scoreBroker({ invoices, termsDays = 30 } = {}) {
  if (!Array.isArray(invoices) || invoices.length === 0) {
    throw new RangeError('scoreBroker requires at least one invoice');
  }
  assertFiniteNumber(termsDays, 'termsDays');
  if (termsDays <= 0) throw new RangeError('termsDays must be greater than 0, got: ' + termsDays);

  let paidCount = 0;
  let unpaidCount = 0;
  let totalBilled = 0;
  let totalOutstanding = 0;
  const paidDays = [];
  let lateCount = 0;

  invoices.forEach((invoice, i) => {
    if (!invoice || typeof invoice !== 'object') {
      throw new RangeError('invoices[' + i + '] must be an object with amount and daysToPay');
    }
    assertFiniteNumber(invoice.amount, 'invoices[' + i + '].amount');
    if (invoice.amount < 0) {
      throw new RangeError('invoices[' + i + '].amount must be 0 or more, got: ' + invoice.amount);
    }
    totalBilled += invoice.amount;
    if (invoice.paid === false) {
      unpaidCount += 1;
      totalOutstanding += invoice.amount;
      return;
    }
    assertFiniteNumber(invoice.daysToPay, 'invoices[' + i + '].daysToPay');
    if (invoice.daysToPay < 0) {
      throw new RangeError('invoices[' + i + '].daysToPay must be 0 or more, got: ' + invoice.daysToPay);
    }
    paidCount += 1;
    paidDays.push(invoice.daysToPay);
    if (invoice.daysToPay > termsDays) lateCount += 1;
  });

  const flags = [];
  if (unpaidCount > 0) flags.push('has unpaid invoices');

  if (paidCount === 0) {
    return {
      termsDays,
      paidCount,
      unpaidCount,
      avgDaysToPay: null,
      medianDaysToPay: null,
      latePercent: 0,
      totalBilled: round2(totalBilled),
      totalOutstanding: round2(totalOutstanding),
      grade: 'F',
      recommendation: RECOMMENDATIONS.F,
      flags,
    };
  }

  const avgDays = paidDays.reduce((a, b) => a + b, 0) / paidCount;
  const latePercent = round2((lateCount / paidCount) * 100);

  let grade;
  if (avgDays <= termsDays && latePercent <= 10) grade = 'A';
  else if (avgDays <= termsDays + 7 && latePercent <= 25) grade = 'B';
  else if (avgDays <= termsDays + 15) grade = 'C';
  else if (avgDays <= termsDays + 30) grade = 'D';
  else grade = 'F';

  return {
    termsDays,
    paidCount,
    unpaidCount,
    avgDaysToPay: round2(avgDays),
    medianDaysToPay: round2(median(paidDays)),
    latePercent,
    totalBilled: round2(totalBilled),
    totalOutstanding: round2(totalOutstanding),
    grade,
    recommendation: RECOMMENDATIONS[grade],
    flags,
  };
}

// What quick-pay really costs. Brokers advertise "2 percent for
// quick-pay" as if it were 2 percent a year; it is 2 percent for
// getting your money daysEarly days sooner, which annualises to a
// much bigger number. Compare that number against your factoring
// rate and against the cost of just waiting out the terms.
function quickPayMath({ amount, quickPayPercent = 2, daysEarly } = {}) {
  assertFiniteNumber(amount, 'amount');
  assertFiniteNumber(quickPayPercent, 'quickPayPercent');
  assertFiniteNumber(daysEarly, 'daysEarly');
  if (amount <= 0) throw new RangeError('amount must be greater than 0, got: ' + amount);
  if (quickPayPercent < 0 || quickPayPercent >= 100) {
    throw new RangeError('quickPayPercent must be 0 or more and under 100, got: ' + quickPayPercent);
  }
  if (daysEarly <= 0) throw new RangeError('daysEarly must be greater than 0, got: ' + daysEarly);

  const fee = round2(amount * (quickPayPercent / 100));
  const netReceived = round2(amount - fee);
  const effectiveAnnualRatePercent = round2((fee / netReceived) * (365 / daysEarly) * 100);
  return { amount, quickPayPercent, daysEarly, fee, netReceived, effectiveAnnualRatePercent };
}

module.exports = { scoreBroker, quickPayMath };
