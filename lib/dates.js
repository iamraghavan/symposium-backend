// lib/dates.js

/**
 * Safe date parsing:
 * - accepts Date | string | number
 * - returns a *new* Date instance or null if invalid
 */
function toDate(input) {
  if (input instanceof Date) {
    const d = new Date(input.getTime());
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === "string" || typeof input === "number") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Start of day in the current server timezone (UTC if server runs UTC) */
function startOfDay(d) {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

/** End of day in the current server timezone */
function endOfDay(d) {
  const x = new Date(d.getTime());
  x.setHours(23, 59, 59, 999);
  return x;
}

/** ISO string helper (always `.toISOString()`) */
function toISO(d) {
  return d instanceof Date ? d.toISOString() : null;
}

/**
 * Pick a date range from the request query.
 *
 * Query params:
 *   - from: ISO string or any Date-parsable value
 *   - to:   ISO string or any Date-parsable value
 *
 * Options:
 *   - defDays (number): if no range is provided, defaults to [now - defDays, now] (default 30)
 *   - clampToDay (boolean): normalize from->startOfDay and to->endOfDay (default true)
 *
 * Returns: { from: Date, to: Date }
 *
 * Notes:
 *   - If only `from` is provided, `to` defaults to now.
 *   - If only `to`   is provided, `from` defaults to to - defDays.
 *   - If from > to after parsing, they are swapped for safety.
 */
function pickRange(req, { defDays = 30, clampToDay = true } = {}) {
  const q = req?.query || {};

  const now = new Date();

  let from = q.from ? toDate(q.from) : null;
  let to   = q.to   ? toDate(q.to)   : null;

  if (!from && !to) {
    // default window
    from = new Date(now.getTime() - defDays * 24 * 60 * 60 * 1000);
    to = new Date(now);
  } else if (from && !to) {
    // open-ended -> now
    to = new Date(now);
  } else if (!from && to) {
    // backfill from by defDays
    from = new Date(to.getTime() - defDays * 24 * 60 * 60 * 1000);
  }

  // Fallbacks in case parsing failed
  if (!(from instanceof Date) || isNaN(from.getTime())) {
    from = new Date(now.getTime() - defDays * 24 * 60 * 60 * 1000);
  }
  if (!(to instanceof Date) || isNaN(to.getTime())) {
    to = new Date(now);
  }

  // Ensure from <= to (swap if needed)
  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  if (clampToDay) {
    from = startOfDay(from);
    to = endOfDay(to);
  }

  return { from, to };
}

module.exports = {
  toDate,
  startOfDay,
  endOfDay,
  toISO,
  pickRange
};
