'use strict';

// The rest of the accessorial bundle: layover and TONU charges, and a
// combined claim letter that bills several accessorials for one load
// together. Detention has its own module (detention.js) because its
// math, free time and increments, is more involved.
//
// The numbers only get paid when they were agreed before the truck
// rolled, ideally in writing on the rate confirmation. These helpers
// do the math and the paperwork; the agreement is still on you.

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return '$' + Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(name + ' must be a finite number, got: ' + String(value));
  }
}

// Layover: the truck and driver are held over a full day through no
// fault of the carrier, usually a facility closure or a missed
// appointment the broker or shipper caused. Priced per day; 250 per
// day is the common default when the rate con does not name a figure.
function layoverCharge({ days, ratePerDay = 250 } = {}) {
  assertFiniteNumber(days, 'days');
  assertFiniteNumber(ratePerDay, 'ratePerDay');
  if (days <= 0) throw new RangeError('days must be greater than 0, got: ' + days);
  if (ratePerDay < 0) throw new RangeError('ratePerDay must be 0 or more, got: ' + ratePerDay);
  return { days, ratePerDay, amount: round2(days * ratePerDay) };
}

// TONU: truck ordered, not used. The carrier deadheaded to the shipper
// and the load was cancelled. When the rate con names a TONU figure,
// that figure governs ('agreed'). When it does not, the working
// default used across the industry is 25 percent of the linehaul,
// floored at 150 and capped at 500.
function tonuCharge({ agreedTonu, linehaul } = {}) {
  if (agreedTonu !== undefined) {
    assertFiniteNumber(agreedTonu, 'agreedTonu');
    if (agreedTonu < 0) throw new RangeError('agreedTonu must be 0 or more, got: ' + agreedTonu);
    return { amount: round2(agreedTonu), basis: 'agreed' };
  }
  assertFiniteNumber(linehaul, 'linehaul');
  if (linehaul <= 0) {
    throw new RangeError('linehaul must be greater than 0 when no agreedTonu is given, got: ' + linehaul);
  }
  const amount = Math.min(500, Math.max(150, linehaul * 0.25));
  return { amount: round2(amount), basis: 'default 25% of linehaul, $150-$500' };
}

// One claim letter covering every accessorial on a load: detention,
// layover, TONU, lumper, whatever was incurred. Brokers pay one
// reconciled claim faster than four separate emails, and the total
// is harder to quietly shrink. Same evidence rule as detention:
// ELD timestamps and the signed BOL back every line.
function combinedClaimLetter({
  carrierName,
  mcNumber,
  brokerName,
  loadReference,
  items,
  dispatcherName,
  companyName,
  dateISO,
} = {}) {
  const required = {
    carrierName, mcNumber, brokerName, loadReference, dispatcherName, companyName, dateISO,
  };
  for (const [name, value] of Object.entries(required)) {
    if (value === undefined || value === null || value === '') {
      throw new RangeError('combinedClaimLetter requires ' + name);
    }
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new RangeError('combinedClaimLetter requires a non-empty items array');
  }
  items.forEach((item, i) => {
    if (!item || typeof item !== 'object') {
      throw new RangeError('items[' + i + '] must be an object with type, description and amount');
    }
    if (typeof item.type !== 'string' || item.type === '') {
      throw new RangeError('items[' + i + '].type must be a non-empty string');
    }
    if (typeof item.description !== 'string' || item.description === '') {
      throw new RangeError('items[' + i + '].description must be a non-empty string');
    }
    assertFiniteNumber(item.amount, 'items[' + i + '].amount');
    if (item.amount < 0) throw new RangeError('items[' + i + '].amount must be 0 or more');
  });

  const total = round2(items.reduce((sum, item) => sum + item.amount, 0));

  const lines = [
    companyName,
    'Date: ' + dateISO,
    '',
    'To: ' + brokerName,
    'Subject: Accessorial Claim, Load ' + loadReference + ', ' + carrierName + ' (MC ' + mcNumber + ')',
    '',
    'Dear ' + brokerName + ' accounts payable team,',
    '',
    'We are submitting an accessorial claim for the load referenced below. Each',
    'charge was agreed on the rate confirmation for this load or incurred under',
    'the accessorial terms of our carrier agreement.',
    '',
    'Load facts',
    '  Carrier:        ' + carrierName + ' (MC ' + mcNumber + ')',
    '  Broker:         ' + brokerName,
    '  Load reference: ' + loadReference,
    '',
    'Charges',
    ...items.map((item) => '  ' + item.type + ', ' + item.description + ': ' + money(item.amount)),
    '  Total due:      ' + money(total),
    '',
    'Please add ' + money(total) + ' to the settlement for this load, or issue payment',
    'within the terms of our carrier agreement. ELD timestamps for the times behind',
    'these charges and the signed bill of lading with in and out times noted are',
    'attached to this claim for verification.',
    '',
    'If any detail above does not match your records, reply to this letter and we',
    'will reconcile the timestamps with the driver log the same business day.',
    '',
    'Thank you,',
    dispatcherName,
    companyName,
  ];
  return lines.join('\n') + '\n';
}

module.exports = { layoverCharge, tonuCharge, combinedClaimLetter };
