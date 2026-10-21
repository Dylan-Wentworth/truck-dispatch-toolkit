'use strict';

// Detention time calculation and claim letter generation.
//
// Detention is paid waiting time at a shipper or receiver beyond an
// agreed free-time window. The math here follows the common contract
// shape: dwell time minus free time minus any grace period, with the
// billable remainder rounded UP to a billing increment (usually
// 15 minutes) so the carrier is never shorted by rounding.

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(value) {
  return '$' + Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseTime(iso, name) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(name + ' is not a valid date/time: ' + String(iso));
  }
  return d;
}

function detentionCharge({
  arrivalISO,
  departureISO,
  freeHours = 2,
  ratePerHour,
  graceMinutes = 0,
  incrementMinutes = 15,
} = {}) {
  const arrival = parseTime(arrivalISO, 'arrivalISO');
  const departure = parseTime(departureISO, 'departureISO');
  if (typeof ratePerHour !== 'number' || !Number.isFinite(ratePerHour) || ratePerHour < 0) {
    throw new RangeError('ratePerHour must be a finite number of 0 or more, got: ' + String(ratePerHour));
  }
  if (freeHours < 0) throw new RangeError('freeHours must be 0 or more, got: ' + freeHours);
  if (graceMinutes < 0) throw new RangeError('graceMinutes must be 0 or more, got: ' + graceMinutes);
  if (incrementMinutes <= 0) throw new RangeError('incrementMinutes must be greater than 0, got: ' + incrementMinutes);
  if (departure < arrival) {
    throw new RangeError('departureISO is before arrivalISO; detention cannot be negative');
  }

  const dwellMinutes = (departure - arrival) / 60000;
  const rawBillable = dwellMinutes - freeHours * 60 - graceMinutes;
  const billableMinutes = rawBillable <= 0
    ? 0
    : Math.ceil(rawBillable / incrementMinutes) * incrementMinutes;
  const billableHours = billableMinutes / 60;

  return {
    dwellMinutes: round2(dwellMinutes),
    dwellHours: round2(dwellMinutes / 60),
    billableMinutes,
    billableHours: round2(billableHours),
    ratePerHour,
    amount: round2(billableHours * ratePerHour),
  };
}

// A ready-to-send detention claim letter as plain text.
// Pass the outputs of detentionCharge (amount, billableHours) along
// with the load facts. Keep the signed BOL and ELD timestamps ready;
// brokers routinely ask for both before paying.
function claimLetter({
  carrierName,
  mcNumber,
  brokerName,
  loadReference,
  facility,
  city,
  state,
  arrivalISO,
  departureISO,
  freeHours,
  ratePerHour,
  amount,
  billableHours,
  dispatcherName,
  companyName,
  dateISO,
} = {}) {
  const required = {
    carrierName, mcNumber, brokerName, loadReference, facility, city, state,
    arrivalISO, departureISO, dispatcherName, companyName, dateISO,
  };
  for (const [name, value] of Object.entries(required)) {
    if (value === undefined || value === null || value === '') {
      throw new RangeError('claimLetter requires ' + name);
    }
  }
  const charge = detentionCharge({ arrivalISO, departureISO, freeHours, ratePerHour });
  const billable = billableHours !== undefined ? billableHours : charge.billableHours;
  const due = amount !== undefined ? amount : charge.amount;

  const lines = [
    companyName,
    'Date: ' + dateISO,
    '',
    'To: ' + brokerName,
    'Subject: Detention Claim, Load ' + loadReference + ', ' + carrierName + ' (MC ' + mcNumber + ')',
    '',
    'Dear ' + brokerName + ' accounts payable team,',
    '',
    'We are submitting a detention claim for the load referenced below. The driver',
    'arrived on time for the scheduled appointment and was held at the facility',
    'beyond the agreed free time.',
    '',
    'Load facts',
    '  Carrier:        ' + carrierName + ' (MC ' + mcNumber + ')',
    '  Broker:         ' + brokerName,
    '  Load reference: ' + loadReference,
    '  Facility:       ' + facility + ', ' + city + ', ' + state,
    '  Arrival:        ' + arrivalISO,
    '  Departure:      ' + departureISO,
    '  Dwell time:     ' + charge.dwellHours.toFixed(2) + ' hours',
    '  Free time:      ' + Number(freeHours).toFixed(2) + ' hours',
    '  Billable time:  ' + Number(billable).toFixed(2) + ' hours at ' + money(ratePerHour) + ' per hour',
    '  Amount due:     ' + money(due),
    '',
    'Please add ' + money(due) + ' to the settlement for this load, or issue payment',
    'within the terms of our carrier agreement. ELD timestamps for the arrival and',
    'departure above and the signed bill of lading with in and out times noted are',
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

module.exports = { detentionCharge, claimLetter };
