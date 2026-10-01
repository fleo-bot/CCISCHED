/**
 * availability-utils.js
 * ---------------------
 * Shared helpers for turning the backend's availability slots into what the
 * UI draws, and back again.
 *
 * The database stores a slot as a set of days plus ONE continuous time range:
 *     { slot_number, day_indices: [0,2,4], time_start: "09:00",
 *       time_end: "13:30", time_label: "9:00 AM – 1:30 PM" }
 * while the timetable grid is made of fixed 90-minute class blocks.
 *
 * Exposed as window.AvailabilityUtils (wrapped in a function so the names
 * below can't clash with the page scripts' own top-level constants).
 */
(function (global) {
  'use strict';

  // The timetable rows. start/end are minutes since midnight.
  const TIME_BLOCKS = [
    { label: '7:30 - 9:00',    start:  450, end:  540 },
    { label: '9:00 - 10:30',   start:  540, end:  630 },
    { label: '10:30 - 12:00',  start:  630, end:  720 },
    { label: '12:00 - 1:30',   start:  720, end:  810 },
    { label: '1:30 - 3:00',    start:  810, end:  900 },
    { label: '3:00 - 4:30',    start:  900, end:  990 },
    { label: '4:30 - 6:00',    start:  990, end: 1080 },
    { label: '6:00 - 7:30',    start: 1080, end: 1170 },
    { label: '7:30 - 9:00 PM', start: 1170, end: 1260 },
  ];

  // "08:00", "13:00:00", "9:00 AM" → minutes since midnight (null if unparseable)
  function parseClock(str) {
    const m = /^\s*(\d{1,2}):(\d{2})(?::(?:\d{2})?)?\s*([AP]M)?\s*$/i.exec(String(str ?? ''));
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const mer = m[3] && m[3].toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  // minutes since midnight → "1:30 PM"
  function fmtClock(mins) {
    const h = Math.floor(mins / 60);
    const m = String(mins % 60).padStart(2, '0');
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  // minutes since midnight → "13:30" (what the backend stores)
  function toClock24(mins) {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  // A slot's time_start/time_end → { start, end } in minutes (null if unusable).
  // Nothing on this timetable happens before 7:30 AM, so an hour of 1–6 in a
  // 24h value can only be an afternoon time that lost its "PM" (older saves
  // stored e.g. 1:30 PM as "01:30") — shift it back into the afternoon.
  function slotRange(slot) {
    const fix = t => (t !== null && t >= 60 && t < 7 * 60) ? t + 12 * 60 : t;
    const start = fix(parseClock(slot.time_start));
    const end   = fix(parseClock(slot.time_end));
    if (start === null || end === null || end <= start) return null;
    return { start, end };
  }

  // Grid rows covered by a range. A row counts only if the whole 90-minute
  // block fits inside it (8:00–12:00 covers 9:00–10:30 and 10:30–12:00, but
  // not 7:30–9:00).
  function blocksWithin(range) {
    return TIME_BLOCKS.filter(b => b.start >= range.start && b.end <= range.end)
                      .map(b => b.label);
  }

  // Display label for a slot, always in 12h form ("8:00 AM – 12:00 PM").
  function slotLabel(slot) {
    const r = slotRange(slot);
    return r ? `${fmtClock(r.start)} – ${fmtClock(r.end)}` : (slot.time_label || '');
  }

  function sortSlots(slots) {
    return [...(slots || [])].sort((a, b) => (a.slot_number ?? 0) - (b.slot_number ?? 0));
  }

  /**
   * API slots → cards the timetable views draw:
   *   { slotNumber, range, dayIndices, timeLabel, times }
   *
   * merge:false → one card per stored slot, in slot_number order (faculty
   *               views, where a card maps to an editable slot).
   * merge:true  → slots with the same time window are combined into one card
   *               covering all their days, ordered by start time (chairperson
   *               views; the seed data stores one row per day).
   */
  function buildSlotCards(apiSlots, { merge = false } = {}) {
    const sorted = sortSlots(apiSlots);

    const toCard = (s) => {
      const range = slotRange(s);
      return {
        slotNumber: s.slot_number,
        range,
        dayIndices: [...(s.day_indices || [])].sort((a, b) => a - b),
        timeLabel:  range ? `${fmtClock(range.start)} – ${fmtClock(range.end)}` : (s.time_label || '—'),
        times:      range ? blocksWithin(range) : [],
      };
    };

    if (!merge) return sorted.map(toCard);

    const groups = new Map();
    sorted.forEach(s => {
      const card = toCard(s);
      const key  = card.range ? `${card.range.start}-${card.range.end}` : `raw:${card.timeLabel}`;
      if (!groups.has(key)) {
        groups.set(key, { ...card, dayIndices: new Set() });
      }
      card.dayIndices.forEach(d => groups.get(key).dayIndices.add(d));
    });

    return [...groups.values()]
      .map(g => ({ ...g, dayIndices: [...g.dayIndices].sort((a, b) => a - b) }))
      .sort((a, b) => (a.range ? a.range.start : Infinity) - (b.range ? b.range.start : Infinity));
  }

  // A stored slot → the body the save endpoint expects, passed through
  // untouched apart from renumbering (never re-parse a label to rebuild it).
  function toPayload(slot, slotNumber) {
    return {
      slot_number: slotNumber,
      day_indices: slot.day_indices || [],
      time_start:  slot.time_start,
      time_end:    slot.time_end,
      time_label:  slot.time_label,
    };
  }

  global.AvailabilityUtils = {
    TIME_BLOCKS,
    parseClock, fmtClock, toClock24,
    slotRange, blocksWithin, slotLabel,
    sortSlots, buildSlotCards, toPayload,
  };
})(window);
