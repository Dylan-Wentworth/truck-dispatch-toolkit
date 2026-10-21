'use strict';

const assert = require('node:assert');
const toolkit = require('../src/index');
const { trueRate, breakEven, rateVerdict } = toolkit;
const { loadProfit } = toolkit;
const { planTrip, resetAdvice } = toolkit;
const { detentionCharge, claimLetter } = toolkit;
const { gallonsByState, taxEstimate } = toolkit;

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('ok ' + passed + ' - ' + name);
}
function approx(actual, expected, tolerance = 0.005) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    'expected ' + actual + ' to be within ' + tolerance + ' of ' + expected
  );
}

// ---------- rates.trueRate ----------
test('trueRate: hand-checked example, 2400 on 800 loaded + 100 deadhead', () => {
  const r = trueRate({ linehaul: 2400, loadedMiles: 800, deadheadMiles: 100 });
  assert.strictEqual(r.revenue, 2400);
  assert.strictEqual(r.totalMiles, 900);
  assert.strictEqual(r.rpmLoaded, 3.0);
  approx(r.rpmAllMiles, 2.67, 0.01); // 2400 / 900 = 2.6667
  assert.strictEqual(r.deadheadPercent, 11.11); // 100 / 900 = 11.11 percent
});

test('trueRate: accessorials add to revenue', () => {
  const r = trueRate({ linehaul: 2000, accessorials: 250, loadedMiles: 750 });
  assert.strictEqual(r.revenue, 2250);
  assert.strictEqual(r.rpmLoaded, 3.0);
  assert.strictEqual(r.deadheadPercent, 0);
});

test('trueRate: rejects zero loaded miles', () => {
  assert.throws(() => trueRate({ linehaul: 1000, loadedMiles: 0 }), RangeError);
});

// ---------- rates.breakEven ----------
test('breakEven: cost plus margin markup', () => {
  approx(breakEven({ costPerMile: 2.0, targetMarginPercent: 10 }), 2.2, 1e-9);
  approx(breakEven({ costPerMile: 2.336 }), 2.336, 1e-9); // ATRI 2025 average cost per mile
});

// ---------- rates.rateVerdict ----------
test('rateVerdict: all four bands against a 2.00 break-even', () => {
  assert.strictEqual(rateVerdict({ rpmAllMiles: 1.9, breakEvenRpm: 2.0 }).verdict, 'below cost');
  assert.strictEqual(rateVerdict({ rpmAllMiles: 2.05, breakEvenRpm: 2.0 }).verdict, 'thin');
  assert.strictEqual(rateVerdict({ rpmAllMiles: 2.3, breakEvenRpm: 2.0 }).verdict, 'fair');
  assert.strictEqual(rateVerdict({ rpmAllMiles: 2.7, breakEvenRpm: 2.0 }).verdict, 'strong');
  const v = rateVerdict({ rpmAllMiles: 2.5, breakEvenRpm: 2.0 });
  assert.strictEqual(v.spreadPercent, 25);
});

// ---------- profit.loadProfit ----------
test('loadProfit: full worked example, every component asserted', () => {
  // By hand:
  //   gross      = 3000 + 150 detention + 75 lumper reimbursed = 3225
  //   miles      = 1000 loaded + 120 deadhead = 1120
  //   gallons    = 1120 / 6.5 = 172.3077 -> 172.31
  //   fuel       = 172.3077 * 3.80 = 654.7692 -> 654.77
  //   factoring  = 3225 * 3 percent = 96.75
  //   driver pay = 25 percent of linehaul 3000 = 750
  //   costs      = 654.77 + 96.75 + 750 + 45 tolls + 75 lumper = 1621.52
  //   net        = 3225 - 1621.5192 = 1603.4808 -> 1603.48
  //   per mile   = 1603.4808 / 1120 = 1.4317 -> 1.43
  //   margin     = 1603.4808 / 3225 = 49.72 percent
  const p = loadProfit({
    linehaul: 3000, detentionPay: 150, lumperReimbursed: 75,
    loadedMiles: 1000, deadheadMiles: 120,
    mpg: 6.5, fuelPricePerGallon: 3.8,
    factoringPercent: 3, tolls: 45,
    driverPayPercent: 25, lumperCost: 75,
  });
  assert.strictEqual(p.grossRevenue, 3225);
  assert.strictEqual(p.totalMiles, 1120);
  assert.strictEqual(p.gallonsUsed, 172.31);
  assert.strictEqual(p.fuelCost, 654.77);
  assert.strictEqual(p.factoringCost, 96.75);
  assert.strictEqual(p.driverPay, 750);
  assert.strictEqual(p.totalCosts, 1621.52);
  assert.strictEqual(p.netProfit, 1603.48);
  assert.strictEqual(p.profitPerMile, 1.43);
  assert.strictEqual(p.marginPercent, 49.72);
});

test('loadProfit: per-mile driver pay when no percent given', () => {
  const p = loadProfit({
    linehaul: 2000, loadedMiles: 1000, mpg: 6, fuelPricePerGallon: 4,
    driverPayPerMile: 0.65,
  });
  assert.strictEqual(p.driverPay, 650);
});

test('loadProfit: percent driver pay wins over per-mile', () => {
  const p = loadProfit({
    linehaul: 2000, loadedMiles: 1000, mpg: 6, fuelPricePerGallon: 4,
    driverPayPercent: 25, driverPayPerMile: 0.65,
  });
  assert.strictEqual(p.driverPay, 500); // 25 percent of 2000, not 650
});

// ---------- hos.planTrip ----------
test('planTrip: feasible 500 mile trip', () => {
  // driving = 500 / 50 = 10h; one break (crosses the 8h mark once) = 0.5h
  // duty = 10 + 0.5 + 1 loading + 1 unloading = 12.5h
  // tightest constraint: duty 12.5 of 13 remaining shift hours (96 percent)
  const t = planTrip({
    distanceMiles: 500, averageMph: 50, loadingHours: 1, unloadingHours: 1,
    driveHoursAvailable: 10.5, shiftHoursAvailable: 13, cycleHoursAvailable: 40,
  });
  assert.strictEqual(t.drivingHours, 10);
  assert.strictEqual(t.breakCount, 1);
  assert.strictEqual(t.totalDutyHours, 12.5);
  assert.strictEqual(t.feasible, true);
  assert.deepStrictEqual(t.violations, []);
  assert.strictEqual(t.limitingFactor, 'remaining shift hours');
});

test('planTrip: exactly 8 hours of driving needs no break', () => {
  const t = planTrip({ distanceMiles: 400, averageMph: 50 });
  assert.strictEqual(t.drivingHours, 8);
  assert.strictEqual(t.breakCount, 0);
  assert.strictEqual(t.feasible, true);
});

test('planTrip: infeasible 700 mile trip flags the driving limit', () => {
  // driving = 14h (over the 11h limit), duty = 14 + 0.5 + 1 + 1 = 16.5h
  const t = planTrip({ distanceMiles: 700, averageMph: 50, loadingHours: 1, unloadingHours: 1 });
  assert.strictEqual(t.drivingHours, 14);
  assert.strictEqual(t.totalDutyHours, 16.5);
  assert.strictEqual(t.feasible, false);
  assert.ok(t.violations.length >= 2);
  assert.strictEqual(t.limitingFactor, '11-hour driving limit');
});

test('resetAdvice: warns under 10 remaining cycle hours', () => {
  const low = resetAdvice({ cycleHoursUsed: 62 });
  assert.strictEqual(low.remainingCycleHours, 8);
  assert.ok(typeof low.warning === 'string' && low.warning.length > 0);
  const fine = resetAdvice({ cycleHoursUsed: 30 });
  assert.strictEqual(fine.remainingCycleHours, 40);
  assert.strictEqual(fine.warning, null);
});

// ---------- detention ----------
test('detentionCharge: 4h10m dwell, 2h free, 15 minute increments', () => {
  // dwell 250 min, free 120, billable raw 130, rounded up to 135 min = 2.25h
  const d = detentionCharge({
    arrivalISO: '2026-10-01T08:00:00Z',
    departureISO: '2026-10-01T12:10:00Z',
    freeHours: 2, ratePerHour: 65,
  });
  assert.strictEqual(d.dwellHours, 4.17);
  assert.strictEqual(d.billableHours, 2.25);
  assert.strictEqual(d.amount, 146.25);
});

test('detentionCharge: inside free time bills zero', () => {
  const d = detentionCharge({
    arrivalISO: '2026-10-01T08:00:00Z',
    departureISO: '2026-10-01T09:30:00Z',
    freeHours: 2, ratePerHour: 65,
  });
  assert.strictEqual(d.billableHours, 0);
  assert.strictEqual(d.amount, 0);
});

test('detentionCharge: grace period absorbs the overrun', () => {
  const d = detentionCharge({
    arrivalISO: '2026-10-01T08:00:00Z',
    departureISO: '2026-10-01T10:10:00Z',
    freeHours: 2, ratePerHour: 65, graceMinutes: 15,
  });
  assert.strictEqual(d.billableHours, 0);
});

test('detentionCharge: departure before arrival throws', () => {
  assert.throws(() => detentionCharge({
    arrivalISO: '2026-10-01T12:00:00Z',
    departureISO: '2026-10-01T08:00:00Z',
    ratePerHour: 65,
  }), RangeError);
});

test('claimLetter: contains carrier, amount and load reference', () => {
  const letter = claimLetter({
    carrierName: 'Bluebonnet Carriers LLC', mcNumber: '123456',
    brokerName: 'Acme Brokerage', loadReference: 'LD-8841',
    facility: 'Big DC Warehouse', city: 'Dallas', state: 'TX',
    arrivalISO: '2026-10-01T08:00:00Z', departureISO: '2026-10-01T12:10:00Z',
    freeHours: 2, ratePerHour: 65, amount: 146.25, billableHours: 2.25,
    dispatcherName: 'Sam Reyes', companyName: 'Dispatch Authority',
    dateISO: '2026-10-02',
  });
  assert.ok(letter.includes('Detention Claim'));
  assert.ok(letter.includes('Bluebonnet Carriers LLC'));
  assert.ok(letter.includes('MC 123456'));
  assert.ok(letter.includes('LD-8841'));
  assert.ok(letter.includes('$146.25'));
  assert.ok(letter.includes('signed bill of lading'));
});

// ---------- ifta ----------
test('gallonsByState: two-state split at 7 mpg', () => {
  const g = gallonsByState({ milesByState: { TX: 500, OK: 200 }, mpg: 7 });
  assert.strictEqual(g.byState.TX.gallons, 71.43); // 500 / 7 = 71.4286
  assert.strictEqual(g.byState.OK.gallons, 28.57); // 200 / 7 = 28.5714
  assert.strictEqual(g.totalMiles, 700);
  assert.strictEqual(g.totalGallons, 100);
});

test('taxEstimate: default 2025 table, TX and OK at 0.20', () => {
  const t = taxEstimate({ milesByState: { TX: 500, OK: 200 }, mpg: 7 });
  assert.strictEqual(t.byState.TX.tax, 14.29); // 71.4286 gal * 0.20
  assert.strictEqual(t.byState.OK.tax, 5.71); // 28.5714 gal * 0.20
  assert.strictEqual(t.totalTax, 20);
  assert.deepStrictEqual(t.unrated, []);
});

test('taxEstimate: unknown state lands in unrated, not an exception', () => {
  const t = taxEstimate({ milesByState: { TX: 500, ZZ: 140 }, mpg: 7 });
  assert.deepStrictEqual(t.unrated, ['ZZ']);
  assert.strictEqual(t.byState.ZZ.gallons, 20);
  assert.strictEqual(t.byState.ZZ.tax, null);
  assert.strictEqual(t.totalTax, 14.29);
});

test('taxEstimate: caller-supplied rates override the default table', () => {
  const t = taxEstimate({ milesByState: { TX: 500, OK: 200 }, mpg: 7, taxRates: { TX: 0.1 } });
  assert.strictEqual(t.byState.TX.tax, 7.14); // 71.4286 * 0.10
  assert.deepStrictEqual(t.unrated, ['OK']);
});

// ---------- index exports ----------
test('index: all modules re-exported', () => {
  for (const fn of ['trueRate', 'breakEven', 'rateVerdict', 'loadProfit', 'planTrip',
    'resetAdvice', 'detentionCharge', 'claimLetter', 'gallonsByState', 'taxEstimate']) {
    assert.strictEqual(typeof toolkit[fn], 'function', fn + ' should be exported');
  }
  assert.strictEqual(toolkit.IFTA_DEFAULT_RATES.TX, 0.2);
});

console.log('\nAll ' + passed + ' tests passed.');
