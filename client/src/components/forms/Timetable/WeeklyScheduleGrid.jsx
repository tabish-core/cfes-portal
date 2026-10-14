import React from 'react';

const DAY_LABELS = {
  Monday: 'MON',
  Tuesday: 'TUES',
  Wednesday: 'WED',
  Thursday: 'THUR',
  Friday: 'FRI',
  Saturday: 'SAT',
  Sunday: 'SUN',
  MON: 'MON',
  TUES: 'TUES',
  WED: 'WED',
  THUR: 'THUR',
  FRI: 'FRI',
  SAT: 'SAT',
  SUN: 'SUN'
};

const timeToMinutes = (t) => {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getActivityTypeClass = (type = '') => {
  const lower = type.toLowerCase();
  if (lower.includes('counsel') || lower.includes('consult')) return 'act-type-counseling';
  if (lower.includes('lab')) return 'act-type-lab';
  if (lower.includes('meet') || lower.includes('admin')) return 'act-type-meeting';
  if (lower.includes('research')) return 'act-type-research';
  if (lower.includes('class') || lower.includes('lecture')) return 'act-type-class';
  return 'act-type-other';
};

const WeeklyScheduleGrid = ({
  timeSlots = [],
  days = [],
  activities = [],
  onEditActivity,
  onAddActivityOnSlot
}) => {
  // Sort time slots chronologically
  const sortedSlots = [...timeSlots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const slotIndexMap = new Map();
  sortedSlots.forEach((slot, idx) => {
    slotIndexMap.set(slot.slotId, idx);
  });
  const slotCount = sortedSlots.length;

  if (slotCount === 0) {
    return (
      <div style={{ marginBottom: '2.5rem' }}>
        <h3
          style={{
            marginBottom: '1.5rem',
            color: '#1e293b',
            fontSize: '1.2rem',
            fontWeight: '600',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '0.75rem',
          }}
        >
          Section 3: Weekly Schedule Grid
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Please configure at least one time slot above to display the weekly schedule table.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3
        style={{
          marginBottom: '1.5rem',
          color: '#1e293b',
          fontSize: '1.2rem',
          fontWeight: '600',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '0.75rem',
        }}
      >
        Section 3: Weekly Schedule Grid
      </h3>

      <div className="grid-table-wrapper">
        <table className="tt-grid-matrix">
          <thead>
            <tr>
              <th style={{ width: '80px', backgroundColor: '#ffffff', color: '#000000', border: '1px solid #000' }}>
                Days
              </th>
              {sortedSlots.map((slot) => (
                <th
                  key={slot.slotId}
                  style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #000' }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {slot.startTime}–{slot.endTime}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((dayCfg) => {
              const dayName = dayCfg.day;
              const dayLabel = DAY_LABELS[dayName] || dayName;

              if (dayCfg.isOffDay) {
                return (
                  <tr key={dayName}>
                    <td
                      className="tt-grid-day-cell"
                      style={{ fontWeight: 700, border: '1px solid #000', textAlign: 'center' }}
                    >
                      {dayLabel}
                    </td>
                    <td
                      colSpan={slotCount}
                      className="tt-offday-banner"
                      style={{
                        backgroundColor: '#b0b0b0',
                        color: '#000000',
                        fontWeight: 700,
                        border: '1px solid #000',
                        letterSpacing: '1.5px',
                        textAlign: 'center'
                      }}
                    >
                      OFF DAY
                    </td>
                  </tr>
                );
              }

              // Filter activities for this day
              const dayActs = activities.filter((a) => a.day === dayName);

              // Map starting slot index -> activity & colspan
              const actByStart = new Map();
              dayActs.forEach((act) => {
                const sIdx = slotIndexMap.get(act.startSlotId);
                const eIdx = slotIndexMap.get(act.endSlotId);
                if (sIdx !== undefined && eIdx !== undefined && eIdx >= sIdx) {
                  actByStart.set(sIdx, {
                    activity: act,
                    startIdx: sIdx,
                    endIdx: eIdx,
                    colspan: eIdx - sIdx + 1,
                  });
                }
              });

              const renderedCells = [];
              let k = 0;
              while (k < slotCount) {
                if (actByStart.has(k)) {
                  const item = actByStart.get(k);
                  const act = item.activity;
                  const typeClass = getActivityTypeClass(act.activityType);

                  renderedCells.push(
                    <td
                      key={`act-${act.id}-${k}`}
                      colSpan={item.colspan}
                      className={`tt-activity-cell ${typeClass}`}
                      style={{
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        border: '1px solid #000',
                        padding: '8px 4px'
                      }}
                      onClick={() => onEditActivity && onEditActivity(act)}
                      title={`Click to edit activity: ${act.title || act.id}`}
                    >
                      <div className="tt-act-title" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#000000' }}>
                        {act.title || 'Scheduled Activity'}
                      </div>
                      {act.venue && (
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#000000', marginTop: '2px' }}>
                          ({act.venue})
                        </div>
                      )}
                      {item.colspan > 1 && (
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '2px' }}>
                          [{item.colspan} slots]
                        </div>
                      )}
                    </td>
                  );
                  k = item.endIdx + 1;
                } else {
                  const currentSlot = sortedSlots[k];
                  renderedCells.push(
                    <td
                      key={`empty-${dayName}-${k}`}
                      className="tt-empty-cell"
                      style={{ border: '1px solid #000' }}
                      onClick={() =>
                        onAddActivityOnSlot &&
                        onAddActivityOnSlot(dayName, currentSlot.slotId)
                      }
                      title={`Click to schedule activity on ${dayName} at ${currentSlot.startTime}`}
                    >
                      <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>+</span>
                    </td>
                  );
                  k++;
                }
              }

              return (
                <tr key={dayName}>
                  <td
                    className="tt-grid-day-cell"
                    style={{ fontWeight: 700, border: '1px solid #000', textAlign: 'center' }}
                  >
                    {dayLabel}
                  </td>
                  {renderedCells}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WeeklyScheduleGrid;
