import React, { useState } from 'react';

const PREDEFINED_ACTIVITY_TYPES = [
  'Course / Class',
  'Student Counseling',
  'Departmental Work',
  'Research Work',
  'OFF',
  'Other'
];

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

const DayActivityEditor = ({
  days = [],
  timeSlots = [],
  activities = [],
  onChangeDays,
  onChangeActivities,
  activeDayTab,
  onSelectDayTab,
  modalActivity,
  onCloseActivityModal,
  onOpenAddActivity,
  onOpenEditActivity
}) => {
  // Sort time slots chronologically
  const sortedSlots = [...timeSlots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  const slotMap = new Map();
  sortedSlots.forEach((s, i) => slotMap.set(s.slotId, { ...s, index: i }));

  // Off day confirmation modal
  const [offDayConfirm, setOffDayConfirm] = useState(null); // { dayName, currentOff, activityCount }

  // Form error inside activity modal
  const [activityFormError, setActivityFormError] = useState('');

  const currentDayCfg = days.find((d) => d.day === activeDayTab) || {
    day: activeDayTab || 'Monday',
    isOffDay: false,
  };

  const dayActivities = activities.filter((a) => a.day === activeDayTab);

  /* ── Toggle Off Day with Confirmation ────────────────────── */
  const handleToggleOffDay = () => {
    const isCurrentlyOff = Boolean(currentDayCfg.isOffDay);
    if (!isCurrentlyOff && dayActivities.length > 0) {
      // Trying to mark as off day while having active activities
      setOffDayConfirm({
        dayName: activeDayTab,
        currentOff: false,
        activityCount: dayActivities.length
      });
    } else {
      applyToggleOffDay(!isCurrentlyOff);
    }
  };

  const applyToggleOffDay = (newOffState) => {
    const updatedDays = days.map((d) =>
      d.day === activeDayTab ? { ...d, isOffDay: newOffState } : d
    );
    onChangeDays(updatedDays);
    setOffDayConfirm(null);
  };

  /* ── Save Activity from Modal ────────────────────────────── */
  const handleSaveActivity = (e) => {
    e.preventDefault();
    setActivityFormError('');

    if (!modalActivity) return;

    const { id, day, startSlotId, endSlotId, activityType, title, venue, notes } = modalActivity;

    if (!title || !title.trim()) {
      setActivityFormError('Activity title or description is required.');
      return;
    }

    if (!startSlotId || !endSlotId) {
      setActivityFormError('Both start slot and end slot are required.');
      return;
    }

    const startSlot = slotMap.get(startSlotId);
    const endSlot = slotMap.get(endSlotId);

    if (!startSlot || !endSlot) {
      setActivityFormError('Selected time slots are invalid or no longer exist.');
      return;
    }

    if (endSlot.index < startSlot.index) {
      setActivityFormError('End slot cannot be chronologically earlier than start slot.');
      return;
    }

    // Check collision with other activities on the same day
    const otherActsOnDay = activities.filter(
      (a) => a.day === day && a.id !== id
    );

    for (const other of otherActsOnDay) {
      const oStart = slotMap.get(other.startSlotId);
      const oEnd = slotMap.get(other.endSlotId);
      if (oStart && oEnd) {
        if (Math.max(startSlot.index, oStart.index) <= Math.min(endSlot.index, oEnd.index)) {
          setActivityFormError(
            `Time span conflicts with '${other.title || other.activityType}' (${oStart.startTime} - ${oEnd.endTime}) on ${day}.`
          );
          return;
        }
      }
    }

    // Persist activity
    const cleanActivity = {
      id: id || `act_${Date.now()}`,
      day,
      startSlotId,
      endSlotId,
      activityType: activityType || 'Class',
      title: title.trim(),
      venue: (venue || '').trim(),
      notes: (notes || '').trim()
    };

    let updatedActivities;
    const exists = activities.some((a) => a.id === cleanActivity.id);
    if (exists) {
      updatedActivities = activities.map((a) =>
        a.id === cleanActivity.id ? cleanActivity : a
      );
    } else {
      updatedActivities = [...activities, cleanActivity];
    }

    onChangeActivities(updatedActivities);
    onCloseActivityModal();
  };

  /* ── Delete Activity ─────────────────────────────────────── */
  const handleDeleteActivity = (actId) => {
    if (window.confirm('Are you sure you want to remove this scheduled activity?')) {
      const updated = activities.filter((a) => a.id !== actId);
      onChangeActivities(updated);
    }
  };

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
        Section 4: Daily Activity Editor
      </h3>

      {/* Day Tabs */}
      <div className="day-tabs-container">
        {days.map((d) => {
          const actsCount = activities.filter((a) => a.day === d.day).length;
          const isActive = d.day === activeDayTab;

          return (
            <button
              key={d.day}
              type="button"
              className={`day-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectDayTab(d.day)}
            >
              <span>{DAY_LABELS[d.day] || d.day}</span>
              {d.isOffDay ? (
                <span className="day-tab-badge offday-tab-badge">Off</span>
              ) : (
                <span className="day-tab-badge">{actsCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Header Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 1.25rem',
          backgroundColor: currentDayCfg.isOffDay ? '#fff1f2' : '#f8fafc',
          border: '1px solid',
          borderColor: currentDayCfg.isOffDay ? '#fecdd3' : '#e2e8f0',
          borderRadius: '8px',
          marginBottom: '1.25rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
              {DAY_LABELS[activeDayTab] || activeDayTab} ({activeDayTab}) Schedule
            </h4>
            {currentDayCfg.isOffDay && (
              <span
                style={{
                  backgroundColor: '#e11d48',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  letterSpacing: '0.5px'
                }}
              >
                OFF DAY
              </span>
            )}
          </div>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            {currentDayCfg.isOffDay
              ? 'This day is marked as an off day. Existing activities are preserved.'
              : `${dayActivities.length} scheduled activity(ies) on this day.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${currentDayCfg.isOffDay ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleToggleOffDay}
          >
            {currentDayCfg.isOffDay ? 'Set as Active Working Day' : 'Mark as Off Day'}
          </button>

          {!currentDayCfg.isOffDay && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={timeSlots.length === 0}
              onClick={() => onOpenAddActivity(activeDayTab)}
            >
              + Add Activity to {activeDayTab}
            </button>
          )}
        </div>
      </div>

      {/* Activities List */}
      {timeSlots.length === 0 ? (
        <div className="tt-empty-box">
          <p>Please configure custom time slots before scheduling activities.</p>
        </div>
      ) : currentDayCfg.isOffDay ? (
        <div className="tt-empty-box" style={{ backgroundColor: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }}>
          <p style={{ fontWeight: 600, margin: '0 0 0.4rem 0' }}>
            {activeDayTab} is configured as an Off Day.
          </p>
          <span style={{ fontSize: '0.85rem' }}>
            No classes will appear in official schedule exports for this day unless set back to an active working day.
          </span>
        </div>
      ) : dayActivities.length === 0 ? (
        <div className="tt-empty-box">
          <p>No activities scheduled for {activeDayTab}.</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onOpenAddActivity(activeDayTab)}
          >
            + Schedule First Activity
          </button>
        </div>
      ) : (
        <div className="day-activities-list">
          {dayActivities.map((act) => {
            const startSlot = slotMap.get(act.startSlotId);
            const endSlot = slotMap.get(act.endSlotId);
            const spanCount =
              startSlot && endSlot ? endSlot.index - startSlot.index + 1 : 1;

            return (
              <div key={act.id} className="activity-card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a' }}>
                      {act.title}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe'
                      }}
                    >
                      {act.activityType}
                    </span>
                    {spanCount > 1 && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569'
                        }}
                      >
                        Spanning {spanCount} Slots
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: '#475569', flexWrap: 'wrap' }}>
                    <span>
                      Time:{' '}
                      <strong>
                        {startSlot ? startSlot.startTime : '??'} –{' '}
                        {endSlot ? endSlot.endTime : '??'}
                      </strong>{' '}
                      ({startSlot?.label || act.startSlotId}
                      {spanCount > 1 ? ` to ${endSlot?.label || act.endSlotId}` : ''})
                    </span>
                    {act.venue && (
                      <span>
                        Venue: <strong>{act.venue}</strong>
                      </span>
                    )}
                  </div>

                  {act.notes && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                      {act.notes}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenEditActivity(act)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => handleDeleteActivity(act.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activity Add / Edit Modal */}
      {modalActivity && (
        <div className="tt-modal-backdrop" onClick={onCloseActivityModal}>
          <div className="tt-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tt-modal-header">
              <h3>
                {modalActivity.id && activities.some((a) => a.id === modalActivity.id)
                  ? 'Edit Activity'
                  : 'Add New Activity'}
              </h3>
              <button
                type="button"
                className="tt-modal-close"
                onClick={onCloseActivityModal}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveActivity}>
              <div className="tt-modal-body">
                {activityFormError && (
                  <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.85rem' }}>
                    {activityFormError}
                  </div>
                )}

                {/* Day Selector */}
                <div className="tt-form-group">
                  <label className="tt-form-label" htmlFor="modalActDay">
                    Day of Week <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    id="modalActDay"
                    className="tt-form-select"
                    value={modalActivity.day}
                    onChange={(e) =>
                      onOpenAddActivity
                        ? onOpenAddActivity(e.target.value, modalActivity)
                        : null
                    }
                  >
                    {days.map((d) => (
                      <option key={d.day} value={d.day}>
                        {d.day} {d.isOffDay ? '(Off Day)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Activity Type & Custom Title */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalActType">
                      Activity Type
                    </label>
                    <select
                      id="modalActType"
                      className="tt-form-select"
                      value={modalActivity.activityType || 'Class'}
                      onChange={(e) =>
                        modalActivity.setField
                          ? modalActivity.setField('activityType', e.target.value)
                          : null
                      }
                    >
                      {PREDEFINED_ACTIVITY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalActTitle">
                      Title / Description <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="modalActTitle"
                      type="text"
                      required
                      placeholder="e.g. CS-101 Programming Fundamentals"
                      className="tt-form-input"
                      value={modalActivity.title || ''}
                      onChange={(e) =>
                        modalActivity.setField
                          ? modalActivity.setField('title', e.target.value)
                          : null
                      }
                    />
                  </div>
                </div>

                {/* Slot Span Selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalStartSlot">
                      Start Time Slot <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      id="modalStartSlot"
                      className="tt-form-select"
                      value={modalActivity.startSlotId || ''}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        if (modalActivity.setField) {
                          modalActivity.setField('startSlotId', newStart);
                          // Auto adjust endSlot if endSlot is earlier
                          const sIdx = slotMap.get(newStart)?.index ?? 0;
                          const eIdx = slotMap.get(modalActivity.endSlotId)?.index ?? -1;
                          if (eIdx < sIdx) {
                            modalActivity.setField('endSlotId', newStart);
                          }
                        }
                      }}
                    >
                      {sortedSlots.map((slot) => (
                        <option key={slot.slotId} value={slot.slotId}>
                          {slot.startTime}–{slot.endTime} ({slot.label || `Slot #${slot.order + 1}`})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalEndSlot">
                      End Time Slot (Spans Consecutive) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      id="modalEndSlot"
                      className="tt-form-select"
                      value={modalActivity.endSlotId || ''}
                      onChange={(e) =>
                        modalActivity.setField
                          ? modalActivity.setField('endSlotId', e.target.value)
                          : null
                      }
                    >
                      {sortedSlots.map((slot) => {
                        const sIdx = slotMap.get(modalActivity.startSlotId)?.index ?? 0;
                        const isEarlier = slot.order < sIdx;
                        return (
                          <option
                            key={slot.slotId}
                            value={slot.slotId}
                            disabled={isEarlier}
                          >
                            {slot.startTime}–{slot.endTime} ({slot.label || `Slot #${slot.order + 1}`})
                            {isEarlier ? ' (Invalid: earlier than start)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Venue and Notes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalActVenue">
                      Venue / Room
                    </label>
                    <input
                      id="modalActVenue"
                      type="text"
                      placeholder="e.g. Lab 2, Room 402"
                      className="tt-form-input"
                      value={modalActivity.venue || ''}
                      onChange={(e) =>
                        modalActivity.setField
                          ? modalActivity.setField('venue', e.target.value)
                          : null
                      }
                    />
                  </div>

                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalActNotes">
                      Optional Notes
                    </label>
                    <input
                      id="modalActNotes"
                      type="text"
                      placeholder="e.g. BSCS Batch 2024"
                      className="tt-form-input"
                      value={modalActivity.notes || ''}
                      onChange={(e) =>
                        modalActivity.setField
                          ? modalActivity.setField('notes', e.target.value)
                          : null
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="tt-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onCloseActivityModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Off Day Confirmation Modal */}
      {offDayConfirm && (
        <div className="tt-modal-backdrop" onClick={() => setOffDayConfirm(null)}>
          <div className="tt-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tt-modal-header" style={{ backgroundColor: '#fff1f2', borderBottomColor: '#fecdd3' }}>
              <h3 style={{ color: '#9f1239' }}>Mark {offDayConfirm.dayName} as Off Day?</h3>
              <button
                type="button"
                className="tt-modal-close"
                onClick={() => setOffDayConfirm(null)}
              >
                &times;
              </button>
            </div>

            <div className="tt-modal-body">
              <p style={{ margin: 0, color: '#334155' }}>
                <strong>{offDayConfirm.dayName}</strong> currently has{' '}
                <strong>{offDayConfirm.activityCount}</strong> scheduled activity(ies).
              </p>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                Marking this day as an off day will not delete your activities, but the entire day will be rendered as &quot;OFF DAY&quot; in timetable document exports.
              </p>
            </div>

            <div className="tt-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOffDayConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#e11d48', borderColor: '#e11d48' }}
                onClick={() => applyToggleOffDay(true)}
              >
                Yes, Mark as Off Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayActivityEditor;
