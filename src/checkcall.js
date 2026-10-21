'use strict';

// Check-call schedule generator.
//
// Brokers judge dispatchers on updates: a departure call, a loaded
// call, steady en-route calls, a one-hour-out warning, and a delivery
// call with the POD requested. This builds that schedule from the
// three times on the rate con, so the calls are planned before the
// truck moves instead of remembered somewhere on the interstate.
//
// All times are the ISO instants passed in, and all formatting is
// UTC. Pass times already converted to UTC; mixing local times into
// the inputs is the classic way to call a driver at 3 a.m.
//
// En-route calls that land in quiet hours are flagged, not dropped:
// the load still matters at 2 a.m., but waking the driver for a
// routine update is a decision, not a default.

function parseTime(iso, name) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(name + ' is not a valid date/time: ' + String(iso));
  }
  return d;
}

function isQuietHour(utcHour, quietHoursStart, quietHoursEnd) {
  if (quietHoursStart === quietHoursEnd) return false;
  if (quietHoursStart < quietHoursEnd) {
    return utcHour >= quietHoursStart && utcHour < quietHoursEnd;
  }
  return utcHour >= quietHoursStart || utcHour < quietHoursEnd;
}

const MINUTE = 60000;
const HOUR = 60 * MINUTE;

function planCheckCalls({
  pickupISO,
  deliveryISO,
  departureISO,
  intervalHours = 4,
  quietHoursStart = 22,
  quietHoursEnd = 6,
} = {}) {
  const pickup = parseTime(pickupISO, 'pickupISO');
  const delivery = parseTime(deliveryISO, 'deliveryISO');
  const departure = parseTime(departureISO, 'departureISO');
  if (typeof intervalHours !== 'number' || !Number.isFinite(intervalHours) || intervalHours <= 0) {
    throw new RangeError('intervalHours must be a finite number greater than 0, got: ' + String(intervalHours));
  }
  for (const [name, value] of [['quietHoursStart', quietHoursStart], ['quietHoursEnd', quietHoursEnd]]) {
    if (!Number.isInteger(value) || value < 0 || value > 23) {
      throw new RangeError(name + ' must be an integer hour from 0 to 23, got: ' + String(value));
    }
  }
  if (departure > pickup) {
    throw new RangeError('departureISO is after pickupISO; the truck departs for the pickup, not after it');
  }
  if (delivery <= pickup) {
    throw new RangeError('deliveryISO must be after pickupISO');
  }

  const calls = [];
  function add(time, label) {
    calls.push({
      timeISO: time.toISOString(),
      label,
      quiet: isQuietHour(time.getUTCHours(), quietHoursStart, quietHoursEnd),
    });
  }

  add(departure, 'departed, rolling to pickup');
  add(new Date(pickup.getTime() - 30 * MINUTE), 'arriving at shipper');
  const loaded = new Date(pickup.getTime() + HOUR);
  add(loaded, 'loaded, paperwork in hand');

  // En-route calls run from the loaded call until one hour before
  // delivery; the one-hour-out call takes over from there. The cap
  // keeps a tiny interval on a long trip from generating thousands
  // of calls; 500 calls at any sane interval covers weeks of driving.
  const enRouteCutoff = delivery.getTime() - HOUR;
  let t = loaded.getTime() + intervalHours * HOUR;
  for (let i = 0; i < 500 && t < enRouteCutoff; i += 1) {
    add(new Date(t), 'en route check call');
    t += intervalHours * HOUR;
  }

  add(new Date(delivery.getTime() - HOUR), 'one hour out');
  add(new Date(delivery.getTime() + 30 * MINUTE), 'delivered, POD requested');

  calls.sort((a, b) => new Date(a.timeISO) - new Date(b.timeISO));
  return calls;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Plain-text rendering, one call per line:
//   2026-10-05 11:00 UTC  departed, rolling to pickup
//   2026-10-06 02:00 UTC  en route check call (quiet hours)
function formatSchedule(calls) {
  if (!Array.isArray(calls)) {
    throw new RangeError('formatSchedule requires an array of calls from planCheckCalls');
  }
  const lines = calls.map((call) => {
    const d = parseTime(call.timeISO, 'call.timeISO');
    const stamp = d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate())
      + ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ' UTC';
    return stamp + '  ' + call.label + (call.quiet ? ' (quiet hours)' : '');
  });
  return lines.join('\n') + '\n';
}

module.exports = { planCheckCalls, formatSchedule };
