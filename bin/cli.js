#!/usr/bin/env node
'use strict';

// Command line interface for truck-dispatch-toolkit.
// Zero dependencies: flags are parsed by hand, values stay simple.
//
// Usage:
//   dispatch-toolkit rate     --linehaul 2400 --loaded-miles 800 --deadhead-miles 100
//   dispatch-toolkit profit   --linehaul 3000 --loaded-miles 1000 --mpg 6.5 --fuel-price 3.80 ...
//   dispatch-toolkit hos      --distance-miles 500 --average-mph 50
//   dispatch-toolkit detention --arrival 2026-10-01T08:00:00Z --departure 2026-10-01T12:10:00Z --rate 65
// Add --json to any command for machine-readable output.

const fs = require('node:fs');
const toolkit = require('../src/index');

const USAGE = [
  'truck-dispatch-toolkit: dispatcher and owner-operator calculators',
  '',
  'Usage: dispatch-toolkit <command> [flags]',
  '',
  'Commands:',
  '  rate       True rate per mile, break-even and rate verdict',
  '  profit     Full load profit breakdown',
  '  hos        Hours-of-service trip feasibility estimate',
  '  detention  Detention charge, and a claim letter with --letter',
  '  lane-add   Record a booked load in a lane book JSON file',
  '  lane-check Judge an offer against your booked lane history',
  '  broker     Broker payment scorecard from your invoice history',
  '  fuel       Trip fuel plan: gallons, stops and burn cost',
  '  checkcall  Check-call schedule for a load (UTC)',
  '  accessorials  Layover and TONU charges, combined letter with --letter',
  '',
  'Common flags: --json prints the raw result object.',
  '',
  'rate flags:',
  '  --linehaul N --accessorials N --loaded-miles N --deadhead-miles N',
  '  --cost-per-mile N --margin-percent N   (adds break-even and verdict)',
  '',
  'profit flags:',
  '  --linehaul N --detention-pay N --layover-pay N --tonu-pay N',
  '  --lumper-reimbursed N --loaded-miles N --deadhead-miles N',
  '  --mpg N --fuel-price N --factoring-percent N --tolls N',
  '  --driver-pay-percent N   (percent of linehaul; wins if both given)',
  '  --driver-pay-per-mile N  --lumper-cost N',
  '',
  'hos flags:',
  '  --distance-miles N --average-mph N --loading-hours N --unloading-hours N',
  '  --drive-available N --shift-available N --cycle-available N',
  '',
  'detention flags:',
  '  --arrival ISO --departure ISO --rate N (per hour)',
  '  --free-hours N --grace-minutes N --increment-minutes N',
  '  --letter with --carrier NAME --mc N --broker NAME --load-ref REF',
  '    --facility NAME --city NAME --state XX --dispatcher NAME',
  '    --company NAME --date YYYY-MM-DD',
  '',
  'lane-add / lane-check flags:',
  '  --file lanes.json (created by lane-add when missing)',
  '  --origin XX --dest XX --equipment NAME --date YYYY-MM-DD',
  '  lane-add:    --linehaul N --loaded-miles N',
  '  lane-check:  --offered-linehaul N --loaded-miles N',
  '',
  'broker flags:',
  "  --days '25,28,30' --amounts '2000,1800,2400' --terms 30",
  '  Amounts are optional; pair them with days in the same order.',
  '',
  'fuel flags:',
  '  --total-miles N --mpg N --tank-capacity N --starting-gallons N',
  '  --fuel-price N --reserve-gallons N',
  '',
  'checkcall flags (all times ISO, treated as UTC):',
  '  --departure ISO --pickup ISO --delivery ISO --interval-hours N',
  '  --quiet-start H --quiet-end H',
  '',
  'accessorials flags:',
  '  --layover-days N --layover-rate N',
  '  --tonu-agreed N or --tonu-linehaul N (default TONU math)',
  '  --letter with --carrier NAME --mc N --broker NAME --load-ref REF',
  '    --dispatcher NAME --company NAME --date YYYY-MM-DD',
  '',
  'Examples:',
  '  dispatch-toolkit rate --linehaul 2400 --loaded-miles 800 --deadhead-miles 100 --cost-per-mile 2.10',
  '  dispatch-toolkit detention --arrival 2026-10-01T08:00:00Z --departure 2026-10-01T12:10:00Z --rate 65',
  '  dispatch-toolkit lane-add --file lanes.json --origin TX --dest OK --linehaul 1500 --loaded-miles 500 --date 2026-09-15',
  '  dispatch-toolkit lane-check --file lanes.json --origin TX --dest OK --offered-linehaul 1200 --loaded-miles 500',
  "  dispatch-toolkit broker --days 25,28,30 --amounts 2000,1800,2400 --terms 30",
  '  dispatch-toolkit fuel --total-miles 1800 --mpg 6 --tank-capacity 120 --starting-gallons 30 --fuel-price 3.90',
  '  dispatch-toolkit checkcall --departure 2026-10-05T11:00:00Z --pickup 2026-10-05T13:00:00Z --delivery 2026-10-06T13:00:00Z',
  '  dispatch-toolkit accessorials --layover-days 2 --tonu-linehaul 2000',
].join('\n');

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = /^-?\d+(\.\d+)?$/.test(next) ? Number(next) : next;
      i += 1;
    }
  }
  return flags;
}

function pick(flags, aliases) {
  const out = {};
  for (const [flag, param] of Object.entries(aliases)) {
    if (flags[flag] !== undefined && flags[flag] !== true) out[param] = flags[flag];
  }
  return out;
}

function money(v) {
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num(v, digits = 2) {
  return Number(v).toFixed(digits);
}
function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function cmdRate(flags) {
  const input = pick(flags, {
    linehaul: 'linehaul', accessorials: 'accessorials',
    'loaded-miles': 'loadedMiles', 'deadhead-miles': 'deadheadMiles',
  });
  const r = toolkit.trueRate(input);
  let verdict = null;
  let breakEvenRpm = null;
  if (flags['cost-per-mile'] !== undefined) {
    breakEvenRpm = toolkit.breakEven({
      costPerMile: flags['cost-per-mile'],
      targetMarginPercent: flags['margin-percent'] || 0,
    });
    verdict = toolkit.rateVerdict({ rpmAllMiles: r.rpmAllMiles, breakEvenRpm });
  }
  if (flags.json) return printJson({ ...r, breakEvenRpm, verdict });
  console.log('True rate');
  console.log('  Revenue:          ' + money(r.revenue));
  console.log('  Miles:            ' + r.loadedMiles + ' loaded + ' + r.deadheadMiles + ' deadhead = ' + r.totalMiles);
  console.log('  Rate (loaded):    ' + money(r.rpmLoaded) + ' per mile');
  console.log('  Rate (all miles): ' + money(r.rpmAllMiles) + ' per mile');
  console.log('  Deadhead:         ' + num(r.deadheadPercent) + '%');
  if (verdict) {
    console.log('  Break-even:       ' + money(breakEvenRpm) + ' per mile');
    console.log('  Verdict:          ' + verdict.verdict + ' (' + num(verdict.spreadPercent) + '% vs break-even)');
  }
}

function cmdProfit(flags) {
  const input = pick(flags, {
    linehaul: 'linehaul', 'detention-pay': 'detentionPay', 'layover-pay': 'layoverPay',
    'tonu-pay': 'tonuPay', 'lumper-reimbursed': 'lumperReimbursed',
    'loaded-miles': 'loadedMiles', 'deadhead-miles': 'deadheadMiles',
    mpg: 'mpg', 'fuel-price': 'fuelPricePerGallon',
    'factoring-percent': 'factoringPercent', tolls: 'tolls',
    'driver-pay-percent': 'driverPayPercent', 'driver-pay-per-mile': 'driverPayPerMile',
    'lumper-cost': 'lumperCost',
  });
  const p = toolkit.loadProfit(input);
  if (flags.json) return printJson(p);
  console.log('Load profit');
  console.log('  Gross revenue:  ' + money(p.grossRevenue) + ' on ' + p.totalMiles + ' total miles');
  console.log('  Fuel:           ' + money(p.fuelCost) + ' (' + num(p.gallonsUsed) + ' gal)');
  console.log('  Factoring:      ' + money(p.factoringCost));
  console.log('  Driver pay:     ' + money(p.driverPay));
  console.log('  Tolls:          ' + money(p.tolls));
  console.log('  Lumper:         ' + money(p.lumperCost));
  console.log('  Total costs:    ' + money(p.totalCosts));
  console.log('  Net profit:     ' + money(p.netProfit) + ' (' + money(p.profitPerMile) + ' per mile, ' + num(p.marginPercent) + '% margin)');
}

function cmdHos(flags) {
  const input = pick(flags, {
    'distance-miles': 'distanceMiles', 'average-mph': 'averageMph', mph: 'averageMph',
    'loading-hours': 'loadingHours', 'unloading-hours': 'unloadingHours',
    'drive-available': 'driveHoursAvailable', 'shift-available': 'shiftHoursAvailable',
    'cycle-available': 'cycleHoursAvailable',
  });
  const t = toolkit.planTrip(input);
  if (flags.json) return printJson(t);
  console.log('Trip feasibility (estimate, not legal advice)');
  console.log('  Driving:        ' + num(t.drivingHours) + 'h with ' + t.breakCount + ' break(s)');
  console.log('  Total duty:     ' + num(t.totalDutyHours) + 'h');
  console.log('  Feasible:       ' + (t.feasible ? 'yes' : 'NO'));
  console.log('  Limiting:       ' + t.limitingFactor);
  for (const v of t.violations) console.log('  Violation:      ' + v);
}

function cmdDetention(flags) {
  const input = pick(flags, {
    arrival: 'arrivalISO', departure: 'departureISO',
    'free-hours': 'freeHours', rate: 'ratePerHour', 'rate-per-hour': 'ratePerHour',
    'grace-minutes': 'graceMinutes', 'increment-minutes': 'incrementMinutes',
  });
  const d = toolkit.detentionCharge(input);
  if (flags.letter) {
    const letterInput = {
      ...pick(flags, {
        carrier: 'carrierName', mc: 'mcNumber', broker: 'brokerName',
        'load-ref': 'loadReference', facility: 'facility', city: 'city', state: 'state',
        dispatcher: 'dispatcherName', company: 'companyName', date: 'dateISO',
      }),
      arrivalISO: input.arrivalISO, departureISO: input.departureISO,
      freeHours: input.freeHours !== undefined ? input.freeHours : 2,
      ratePerHour: input.ratePerHour,
      amount: d.amount, billableHours: d.billableHours,
    };
    console.log(toolkit.claimLetter(letterInput));
    return;
  }
  if (flags.json) return printJson(d);
  console.log('Detention');
  console.log('  Dwell:          ' + num(d.dwellHours) + 'h');
  console.log('  Billable:       ' + num(d.billableHours) + 'h at ' + money(d.ratePerHour) + ' per hour');
  console.log('  Amount due:     ' + money(d.amount));
}

function loadLaneBook(file, createIfMissing) {
  if (!file || file === true) throw new Error('--file is required for lane commands');
  if (!fs.existsSync(file)) {
    if (createIfMissing) return toolkit.createLaneBook();
    throw new Error('Lane file not found: ' + file + '. Create it with lane-add first.');
  }
  return toolkit.laneBookFromJSON(fs.readFileSync(file, 'utf8'));
}

function cmdLaneAdd(flags) {
  const book = loadLaneBook(flags.file, true);
  const load = toolkit.addLoad(book, pick(flags, {
    origin: 'originState', dest: 'destState', equipment: 'equipment',
    linehaul: 'linehaul', 'loaded-miles': 'loadedMiles', date: 'dateISO',
  }));
  fs.writeFileSync(flags.file, toolkit.laneBookToJSON(book) + '\n');
  const stats = toolkit.laneStats(book, { originState: load.originState, destState: load.destState });
  if (flags.json) return printJson({ ...load, laneLoads: stats ? stats.count : 1 });
  console.log('Added to ' + flags.file + ': ' + load.lane + ' ' + load.equipment
    + ', ' + money(load.linehaul) + ' on ' + load.loadedMiles + ' miles ('
    + money(load.rpm) + ' per mile). ' + (stats ? stats.count : 1) + ' load(s) on this lane.');
}

function cmdLaneCheck(flags) {
  const book = loadLaneBook(flags.file, false);
  const input = pick(flags, {
    origin: 'originState', dest: 'destState', equipment: 'equipment',
    'offered-linehaul': 'offeredLinehaul', 'loaded-miles': 'loadedMiles',
  });
  const g = toolkit.rateGuard(book, input);
  if (flags.json) return printJson(g);
  console.log('Lane check ' + g.lane + (input.equipment ? ' (' + input.equipment + ')' : ''));
  if (g.verdict === 'insufficient history') {
    console.log('  History:        ' + g.sampleSize + ' load(s) on this lane; 2 or more needed to judge an offer');
    console.log('  Verdict:        insufficient history');
    return;
  }
  console.log('  Your average:   ' + money(g.avgRpm) + ' per mile on ' + g.sampleSize + ' loads');
  console.log('  Offered:        ' + money(g.offeredRpm) + ' per mile (' + money(input.offeredLinehaul)
    + ' on ' + input.loadedMiles + ' miles)');
  console.log('  Difference:     ' + num(g.percentDiff) + '%');
  console.log('  Verdict:        ' + g.verdict);
  if (g.suggestedCounter !== undefined) {
    const note = g.verdict === 'lowball' ? ' (your average plus 10 percent)' : ' (your lane average)';
    console.log('  Counter at:     ' + money(g.suggestedCounter) + note);
  }
}

function parseNumberList(value, name) {
  if (value === undefined) return null;
  const parts = String(value).split(',').map((s) => s.trim()).filter((s) => s !== '');
  const numbers = parts.map(Number);
  if (numbers.length === 0 || numbers.some((n) => !Number.isFinite(n))) {
    throw new Error('--' + name + ' must be a comma-separated list of numbers, got: ' + String(value));
  }
  return numbers;
}

function cmdBroker(flags) {
  const days = parseNumberList(flags.days, 'days');
  if (!days) throw new Error('--days is required, for example --days 25,28,30');
  const amounts = parseNumberList(flags.amounts, 'amounts');
  const invoices = days.map((d, i) => ({
    amount: amounts && amounts[i] !== undefined ? amounts[i] : 0,
    daysToPay: d,
  }));
  const s = toolkit.scoreBroker({ invoices, termsDays: flags.terms !== undefined ? flags.terms : 30 });
  if (flags.json) return printJson(s);
  console.log('Broker scorecard');
  console.log('  Invoices:       ' + s.paidCount + ' paid, ' + s.unpaidCount + ' unpaid');
  console.log('  Average days:   ' + num(s.avgDaysToPay) + ' (median ' + num(s.medianDaysToPay)
    + ', terms ' + s.termsDays + ')');
  console.log('  Late:           ' + num(s.latePercent) + '% past terms');
  console.log('  Billed:         ' + money(s.totalBilled) + '   Outstanding: ' + money(s.totalOutstanding));
  console.log('  Grade:          ' + s.grade);
  console.log('  Recommendation: ' + s.recommendation);
  for (const flag of s.flags) console.log('  Flag:           ' + flag);
}

function cmdFuel(flags) {
  const f = toolkit.planFuel(pick(flags, {
    'total-miles': 'totalMiles', mpg: 'mpg', 'tank-capacity': 'tankCapacityGallons',
    'starting-gallons': 'startingGallons', 'fuel-price': 'fuelPricePerGallon',
    'reserve-gallons': 'reserveGallons',
  }));
  if (flags.json) return printJson(f);
  console.log('Fuel plan');
  console.log('  Gallons needed: ' + num(f.gallonsNeeded) + ' gal');
  console.log('  Fuel to buy:    ' + num(f.fuelToBuy) + ' gal (after starting fuel, keeping the reserve)');
  console.log('  Stops needed:   ' + f.stopsNeeded);
  console.log('  Range (full):   ' + num(f.rangeMilesOnFullTank, 0) + ' miles');
  console.log('  Burn cost:      ' + money(f.burnCost) + ' (' + money(f.burnCostPerMile) + ' per mile)');
}

function cmdCheckcall(flags) {
  const calls = toolkit.planCheckCalls(pick(flags, {
    pickup: 'pickupISO', delivery: 'deliveryISO', departure: 'departureISO',
    'interval-hours': 'intervalHours', 'quiet-start': 'quietHoursStart', 'quiet-end': 'quietHoursEnd',
  }));
  if (flags.json) return printJson(calls);
  process.stdout.write(toolkit.formatSchedule(calls));
}

function cmdAccessorials(flags) {
  const results = {};
  const items = [];
  if (flags['layover-days'] !== undefined) {
    const l = toolkit.layoverCharge({
      days: flags['layover-days'],
      ratePerDay: flags['layover-rate'] !== undefined ? flags['layover-rate'] : 250,
    });
    results.layover = l;
    items.push({ type: 'Layover', description: l.days + ' day(s) at ' + money(l.ratePerDay) + ' per day', amount: l.amount });
  }
  if (flags['tonu-agreed'] !== undefined || flags['tonu-linehaul'] !== undefined) {
    const t = toolkit.tonuCharge({
      agreedTonu: flags['tonu-agreed'], linehaul: flags['tonu-linehaul'],
    });
    results.tonu = t;
    items.push({ type: 'TONU', description: 'truck ordered, not used (' + t.basis + ')', amount: t.amount });
  }
  if (items.length === 0) {
    throw new Error('Nothing to compute: pass --layover-days or --tonu-agreed / --tonu-linehaul');
  }
  if (flags.letter) {
    const letter = toolkit.combinedClaimLetter({
      ...pick(flags, {
        carrier: 'carrierName', mc: 'mcNumber', broker: 'brokerName',
        'load-ref': 'loadReference', dispatcher: 'dispatcherName',
        company: 'companyName', date: 'dateISO',
      }),
      items,
    });
    console.log(letter);
    return;
  }
  if (flags.json) return printJson(results);
  console.log('Accessorials');
  if (results.layover) {
    console.log('  Layover: ' + results.layover.days + ' day(s) at ' + money(results.layover.ratePerDay)
      + ' per day = ' + money(results.layover.amount));
  }
  if (results.tonu) {
    console.log('  TONU:    ' + money(results.tonu.amount) + ' (' + results.tonu.basis + ')');
  }
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  console.log('  Total:   ' + money(total));
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(USAGE);
    return;
  }
  const flags = parseFlags(rest);
  try {
    if (command === 'rate') cmdRate(flags);
    else if (command === 'profit') cmdProfit(flags);
    else if (command === 'hos') cmdHos(flags);
    else if (command === 'detention') cmdDetention(flags);
    else if (command === 'lane-add') cmdLaneAdd(flags);
    else if (command === 'lane-check') cmdLaneCheck(flags);
    else if (command === 'broker') cmdBroker(flags);
    else if (command === 'fuel') cmdFuel(flags);
    else if (command === 'checkcall') cmdCheckcall(flags);
    else if (command === 'accessorials') cmdAccessorials(flags);
    else {
      console.error('Unknown command: ' + command + '\n');
      console.error(USAGE);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error: ' + err.message);
    process.exit(1);
  }
}

main();
