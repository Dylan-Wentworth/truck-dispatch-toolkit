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
  'Examples:',
  '  dispatch-toolkit rate --linehaul 2400 --loaded-miles 800 --deadhead-miles 100 --cost-per-mile 2.10',
  '  dispatch-toolkit detention --arrival 2026-10-01T08:00:00Z --departure 2026-10-01T12:10:00Z --rate 65',
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
