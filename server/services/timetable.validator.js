/**
 * timetable.validator.js — Comprehensive validation for timetable payloads.
 *
 * Rules:
 *  1. Time format: HH:mm (24-hour).
 *  2. Start time must precede end time.
 *  3. Time slots must have unique slotIds.
 *  4. Time slots must not overlap.
 *  5. Days configuration must not contain duplicate or invalid days.
 *  6. Activity days must be valid days of the week.
 *  7. Activity startSlotId and endSlotId must exist in the provided timeSlots.
 *  8. Activity end slot must not be chronologically earlier than its start slot.
 *  9. Activities on the same day must not overlap (spans cannot intersect).
 *  10. Consulting hours must have valid start/end times (start < end) and no overlaps.
 *  11. Consulting hours must not be placed inside the activities array.
 */
const { DAYS_OF_WEEK } = require('../models/Timetable.model');

const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Convert "HH:mm" to total minutes from midnight for easy comparison.
 * @param {string} timeStr
 * @returns {number}
 */
const timeToMinutes = (timeStr) => {
  if (typeof timeStr !== 'string') return NaN;
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return NaN;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return h * 60 + m;
};

/**
 * Validate standard HH:mm format.
 * @param {string} timeStr
 * @returns {boolean}
 */
const isValidTimeFormat = (timeStr) => {
  if (typeof timeStr !== 'string') return false;
  return TIME_REGEX.test(timeStr.trim());
};

/**
 * Main timetable validation function.
 * @param {object} payload
 * @returns {{ isValid: boolean, errors: Array<{ field: string, message: string }> }}
 */
const validateTimetable = (payload = {}) => {
  const errors = [];
  const {
    timeSlots = [],
    days = [],
    activities = [],
    consultingHours = []
  } = payload;

  /* ── 1. Validate Days Configuration ─────────────────────────────────── */
  if (!Array.isArray(days)) {
    errors.push({ field: 'days', message: 'Days must be an array.' });
  } else {
    const seenDays = new Set();
    days.forEach((d, idx) => {
      if (!d || typeof d !== 'object' || !d.day) {
        errors.push({ field: `days[${idx}]`, message: 'Day configuration is malformed.' });
        return;
      }
      if (!DAYS_OF_WEEK.includes(d.day)) {
        errors.push({ field: `days[${idx}].day`, message: `'${d.day}' is not a valid day of the week.` });
      }
      if (seenDays.has(d.day)) {
        errors.push({ field: `days[${idx}].day`, message: `Duplicate configuration found for day '${d.day}'.` });
      }
      seenDays.add(d.day);

      if (d.isOffDay !== undefined && typeof d.isOffDay !== 'boolean') {
        errors.push({ field: `days[${idx}].isOffDay`, message: `isOffDay for '${d.day}' must be a boolean.` });
      }
    });
  }

  /* ── 2. Validate Time Slots ─────────────────────────────────────────── */
  const slotMap = new Map(); // slotId -> { slot, index, startMin, endMin }
  if (!Array.isArray(timeSlots)) {
    errors.push({ field: 'timeSlots', message: 'timeSlots must be an array.' });
  } else {
    const seenSlotIds = new Set();
    const parsedSlots = [];

    timeSlots.forEach((slot, idx) => {
      if (!slot || typeof slot !== 'object') {
        errors.push({ field: `timeSlots[${idx}]`, message: 'Time slot must be an object.' });
        return;
      }

      const slotId = slot.slotId ? String(slot.slotId).trim() : '';
      if (!slotId) {
        errors.push({ field: `timeSlots[${idx}].slotId`, message: 'Slot ID is required.' });
      } else {
        if (seenSlotIds.has(slotId)) {
          errors.push({ field: `timeSlots[${idx}].slotId`, message: `Slot ID '${slotId}' is duplicated. Slot IDs must be unique.` });
        }
        seenSlotIds.add(slotId);
      }

      if (!isValidTimeFormat(slot.startTime)) {
        errors.push({ field: `timeSlots[${idx}].startTime`, message: `Start time '${slot.startTime}' has an invalid format. Expected HH:mm.` });
      }
      if (!isValidTimeFormat(slot.endTime)) {
        errors.push({ field: `timeSlots[${idx}].endTime`, message: `End time '${slot.endTime}' has an invalid format. Expected HH:mm.` });
      }

      const startMin = timeToMinutes(slot.startTime);
      const endMin = timeToMinutes(slot.endTime);

      if (!isNaN(startMin) && !isNaN(endMin)) {
        if (startMin >= endMin) {
          errors.push({
            field: `timeSlots[${idx}]`,
            message: `Start time '${slot.startTime}' must precede end time '${slot.endTime}' for slot '${slotId || idx}'.`
          });
        } else {
          parsedSlots.push({ slotId, startMin, endMin, slot, originalIndex: idx });
        }
      }
    });

    // Check overlaps among time slots
    for (let i = 0; i < parsedSlots.length; i++) {
      for (let j = i + 1; j < parsedSlots.length; j++) {
        const a = parsedSlots[i];
        const b = parsedSlots[j];
        // Overlap occurs if max(a.start, b.start) < min(a.end, b.end)
        const overlap = Math.max(a.startMin, b.startMin) < Math.min(a.endMin, b.endMin);
        if (overlap) {
          errors.push({
            field: 'timeSlots',
            message: `Time slot '${a.slotId}' (${a.slot.startTime}-${a.slot.endTime}) overlaps with '${b.slotId}' (${b.slot.startTime}-${b.slot.endTime}).`
          });
        }
      }
    }

    // Sort valid slots chronologically to map order indices
    parsedSlots.sort((a, b) => a.startMin - b.startMin);
    parsedSlots.forEach((item, sortedIdx) => {
      slotMap.set(item.slotId, {
        slot: item.slot,
        sortedIndex: sortedIdx,
        startMin: item.startMin,
        endMin: item.endMin
      });
    });
  }

  /* ── 3. Validate Activities ─────────────────────────────────────────── */
  if (!Array.isArray(activities)) {
    errors.push({ field: 'activities', message: 'Activities must be an array.' });
  } else {
    const activitiesByDay = new Map(); // day -> Array<{ act, startIdx, endIdx }>

    activities.forEach((act, idx) => {
      if (!act || typeof act !== 'object') {
        errors.push({ field: `activities[${idx}]`, message: 'Activity must be an object.' });
        return;
      }

      if (!act.id) {
        errors.push({ field: `activities[${idx}].id`, message: 'Activity ID is required.' });
      }

      if (!act.day || !DAYS_OF_WEEK.includes(act.day)) {
        errors.push({ field: `activities[${idx}].day`, message: `Activity day '${act.day}' is invalid.` });
      }

      const startSlot = slotMap.get(act.startSlotId);
      const endSlot = slotMap.get(act.endSlotId);

      if (!startSlot) {
        errors.push({
          field: `activities[${idx}].startSlotId`,
          message: `Activity '${act.title || act.id}' references nonexistent startSlotId '${act.startSlotId}'.`
        });
      }

      if (!endSlot) {
        errors.push({
          field: `activities[${idx}].endSlotId`,
          message: `Activity '${act.title || act.id}' references nonexistent endSlotId '${act.endSlotId}'.`
        });
      }

      if (startSlot && endSlot) {
        if (endSlot.sortedIndex < startSlot.sortedIndex) {
          errors.push({
            field: `activities[${idx}]`,
            message: `Activity '${act.title || act.id}' end slot '${act.endSlotId}' is chronologically earlier than start slot '${act.startSlotId}'.`
          });
        } else if (act.day) {
          if (!activitiesByDay.has(act.day)) {
            activitiesByDay.set(act.day, []);
          }
          activitiesByDay.get(act.day).push({
            activity: act,
            startIdx: startSlot.sortedIndex,
            endIdx: endSlot.sortedIndex,
            idx
          });
        }
      }
    });

    // Check for activity span collisions on each day
    activitiesByDay.forEach((dayActivities, dayName) => {
      for (let i = 0; i < dayActivities.length; i++) {
        for (let j = i + 1; j < dayActivities.length; j++) {
          const a = dayActivities[i];
          const b = dayActivities[j];
          // Slots overlap if max(a.startIdx, b.startIdx) <= min(a.endIdx, b.endIdx)
          if (Math.max(a.startIdx, b.startIdx) <= Math.min(a.endIdx, b.endIdx)) {
            const titleA = a.activity.title || a.activity.id;
            const titleB = b.activity.title || b.activity.id;
            errors.push({
              field: `activities`,
              message: `Activities '${titleA}' and '${titleB}' overlap on ${dayName}. Activities cannot share or span over intersecting slots on the same day.`
            });
          }
        }
      }
    });
  }

  /* ── 4. Validate Consulting Hours (Stored Separately) ──────────────── */
  if (!Array.isArray(consultingHours)) {
    errors.push({ field: 'consultingHours', message: 'Consulting hours must be an array.' });
  } else {
    const consultingByDay = new Map();

    consultingHours.forEach((ch, idx) => {
      if (!ch || typeof ch !== 'object') {
        errors.push({ field: `consultingHours[${idx}]`, message: 'Consulting hour must be an object.' });
        return;
      }

      if (!ch.id) {
        errors.push({ field: `consultingHours[${idx}].id`, message: 'Consulting hour ID is required.' });
      }

      if (!ch.day || !DAYS_OF_WEEK.includes(ch.day)) {
        errors.push({ field: `consultingHours[${idx}].day`, message: `Consulting hour day '${ch.day}' is invalid.` });
      }

      if (!isValidTimeFormat(ch.startTime)) {
        errors.push({ field: `consultingHours[${idx}].startTime`, message: `Start time '${ch.startTime}' has an invalid format. Expected HH:mm.` });
      }

      if (!isValidTimeFormat(ch.endTime)) {
        errors.push({ field: `consultingHours[${idx}].endTime`, message: `End time '${ch.endTime}' has an invalid format. Expected HH:mm.` });
      }

      const startMin = timeToMinutes(ch.startTime);
      const endMin = timeToMinutes(ch.endTime);

      if (!isNaN(startMin) && !isNaN(endMin)) {
        if (startMin >= endMin) {
          errors.push({
            field: `consultingHours[${idx}]`,
            message: `Consulting hour start time '${ch.startTime}' must precede end time '${ch.endTime}'.`
          });
        } else if (ch.day) {
          if (!consultingByDay.has(ch.day)) {
            consultingByDay.set(ch.day, []);
          }
          consultingByDay.get(ch.day).push({ ch, startMin, endMin });
        }
      }
    });

    // Check for consulting hours overlaps on each day
    consultingByDay.forEach((dayCHs, dayName) => {
      for (let i = 0; i < dayCHs.length; i++) {
        for (let j = i + 1; j < dayCHs.length; j++) {
          const a = dayCHs[i];
          const b = dayCHs[j];
          if (Math.max(a.startMin, b.startMin) < Math.min(a.endMin, b.endMin)) {
            errors.push({
              field: 'consultingHours',
              message: `Consulting hours on ${dayName} (${a.ch.startTime}-${a.ch.endTime} and ${b.ch.startTime}-${b.ch.endTime}) overlap.`
            });
          }
        }
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateTimetable,
  isValidTimeFormat,
  timeToMinutes
};
