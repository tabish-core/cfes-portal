import React, { useState } from 'react';

const STANDARD_PRESETS = [
  { startTime: '08:30', endTime: '09:30', label: '8:30-9:30' },
  { startTime: '09:30', endTime: '10:30', label: '9:30-10:30' },
  { startTime: '10:30', endTime: '11:30', label: '10:30-11:30' },
  { startTime: '11:30', endTime: '14:30', label: '11:30-14:30' },
  { startTime: '14:30', endTime: '16:30', label: '14:30-16:30' },
  { startTime: '16:30', endTime: '17:30', label: '16:30-17:30' },
];

const timeToMinutes = (t) => {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const TimeSlotManager = ({
  timeSlots = [],
  activities = [],
  onChangeTimeSlots,
  onRemoveActivitiesBySlotId,
  validationErrors = []
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState(null);

  // Form state for add/edit modal or inline drawer
  const [slotForm, setSlotForm] = useState({
    slotId: '',
    startTime: '08:30',
    endTime: '10:00',
    label: '',
  });
  const [formError, setFormError] = useState('');

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { slot, affectedCount, affectedTitles }

  /* ── Open Add Form ───────────────────────────────────────── */
  const handleOpenAdd = () => {
    const nextOrder = timeSlots.length + 1;
    // Suggest next time based on last slot end time if available
    let suggestedStart = '08:30';
    let suggestedEnd = '10:00';
    if (timeSlots.length > 0) {
      const last = timeSlots[timeSlots.length - 1];
      if (last.endTime) {
        suggestedStart = last.endTime;
        const [h, m] = last.endTime.split(':').map(Number);
        const endH = String(Math.min(23, h + 1)).padStart(2, '0');
        const endM = String(m + 30 >= 60 ? (m + 30) % 60 : m + 30).padStart(2, '0');
        suggestedEnd = `${endH}:${endM}`;
      }
    }

    setSlotForm({
      slotId: `slot_${Date.now()}`,
      startTime: suggestedStart,
      endTime: suggestedEnd,
      label: `Slot ${nextOrder}`,
    });
    setFormError('');
    setEditingSlotId(null);
    setIsAdding(true);
  };

  /* ── Open Edit Form ──────────────────────────────────────── */
  const handleOpenEdit = (slot) => {
    setSlotForm({
      slotId: slot.slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: slot.label || '',
    });
    setFormError('');
    setEditingSlotId(slot.slotId);
    setIsAdding(true);
  };

  /* ── Validate and Save Slot ─────────────────────────────── */
  const handleSaveSlot = (e) => {
    e.preventDefault();
    setFormError('');

    const { startTime, endTime, label } = slotForm;
    if (!startTime || !endTime) {
      setFormError('Both start time and end time are required.');
      return;
    }

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    if (startMin >= endMin) {
      setFormError(`Start time (${startTime}) must precede end time (${endTime}).`);
      return;
    }

    // Check overlaps with other slots
    const targetSlotId = editingSlotId || slotForm.slotId;
    const otherSlots = timeSlots.filter((s) => s.slotId !== targetSlotId);

    for (const other of otherSlots) {
      const oStart = timeToMinutes(other.startTime);
      const oEnd = timeToMinutes(other.endTime);
      if (Math.max(startMin, oStart) < Math.min(endMin, oEnd)) {
        setFormError(`Time range (${startTime} - ${endTime}) overlaps with existing slot '${other.label || other.slotId}' (${other.startTime} - ${other.endTime}).`);
        return;
      }
    }

    if (editingSlotId) {
      // Edit existing
      const updated = timeSlots.map((s) =>
        s.slotId === editingSlotId
          ? { ...s, startTime, endTime, label: label.trim() }
          : s
      );
      // Re-sort chronologically
      updated.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      updated.forEach((s, i) => (s.order = i));
      onChangeTimeSlots(updated);
    } else {
      // Add new
      const newSlot = {
        slotId: slotForm.slotId,
        startTime,
        endTime,
        label: label.trim() || `Slot ${timeSlots.length + 1}`,
        order: timeSlots.length
      };
      const updated = [...timeSlots, newSlot];
      updated.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      updated.forEach((s, i) => (s.order = i));
      onChangeTimeSlots(updated);
    }

    setIsAdding(false);
    setEditingSlotId(null);
  };

  /* ── Delete Request (with activity dependency check) ───── */
  const handleDeleteClick = (slot) => {
    // Check if any activities depend on this slot
    const affected = activities.filter(
      (a) => a.startSlotId === slot.slotId || a.endSlotId === slot.slotId
    );

    if (affected.length > 0) {
      setDeleteConfirm({
        slot,
        affectedCount: affected.length,
        affectedTitles: affected.map((a) => a.title || 'Untitled activity').slice(0, 3).join(', ')
      });
    } else {
      performDelete(slot.slotId);
    }
  };

  const performDelete = (slotId) => {
    const updated = timeSlots
      .filter((s) => s.slotId !== slotId)
      .map((s, i) => ({ ...s, order: i }));
    onChangeTimeSlots(updated);

    // If activities depended on it, remove them to keep consistency
    if (onRemoveActivitiesBySlotId) {
      onRemoveActivitiesBySlotId(slotId);
    }
    setDeleteConfirm(null);
  };

  /* ── Reorder Slots ──────────────────────────────────────── */
  const handleMove = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= timeSlots.length) return;

    const copy = [...timeSlots];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    copy.forEach((s, i) => (s.order = i));
    onChangeTimeSlots(copy);
  };

  /* ── Load Standard Preset ───────────────────────────────── */
  const handleLoadPresets = () => {
    if (timeSlots.length > 0 && !window.confirm('Replace current time slots with standard presets? Existing activities might need reassignment.')) {
      return;
    }
    const presets = STANDARD_PRESETS.map((p, idx) => ({
      slotId: `slot_preset_${idx + 1}`,
      startTime: p.startTime,
      endTime: p.endTime,
      label: p.label,
      order: idx
    }));
    onChangeTimeSlots(presets);
  };

  const hasSlotError = validationErrors.some((e) => e.field && e.field.startsWith('timeSlots'));

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem', fontWeight: '600' }}>
          Section 2: Time Slots ({timeSlots.length})
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleLoadPresets}
          >
            Load Standard Slots
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenAdd}
          >
            + Add Time Slot
          </button>
        </div>
      </div>

      {hasSlotError && (
        <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '1rem' }}>
          {validationErrors
            .filter((e) => e.field && e.field.startsWith('timeSlots'))
            .map((e, idx) => (
              <p key={idx} className="tt-error-text" style={{ margin: '2px 0' }}>
                {e.message}
              </p>
            ))}
        </div>
      )}

      {timeSlots.length === 0 ? (
        <div className="tt-empty-box">
          <p>No time slots configured yet. Load standard slots or add custom slots.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleLoadPresets}
            >
              Load Standard Slots
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleOpenAdd}
            >
              + Create Custom Slot
            </button>
          </div>
        </div>
      ) : (
        <div className="slots-list-container">
          {timeSlots.map((slot, index) => {
            const startM = timeToMinutes(slot.startTime);
            const endM = timeToMinutes(slot.endTime);
            const durationMins = endM - startM;

            return (
              <div key={slot.slotId} className="slot-row-card">
                <div className="slot-details">
                  <span className="slot-badge-order">#{index + 1}</span>
                  <span className="slot-time-range">
                    {slot.startTime} – {slot.endTime}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    ({durationMins} mins)
                  </span>
                  {slot.label && (
                    <span className="slot-label-text">{slot.label}</span>
                  )}
                </div>

                <div className="slot-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Move Up"
                    disabled={index === 0}
                    onClick={() => handleMove(index, -1)}
                    style={{ padding: '0.25rem 0.5rem' }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Move Down"
                    disabled={index === timeSlots.length - 1}
                    onClick={() => handleMove(index, 1)}
                    style={{ padding: '0.25rem 0.5rem' }}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEdit(slot)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => handleDeleteClick(slot)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Time Slot Modal */}
      {isAdding && (
        <div className="tt-modal-backdrop" onClick={() => setIsAdding(false)}>
          <div className="tt-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tt-modal-header">
              <h3>{editingSlotId ? 'Edit Time Slot' : 'Add New Time Slot'}</h3>
              <button
                type="button"
                className="tt-modal-close"
                onClick={() => setIsAdding(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSlot}>
              <div className="tt-modal-body">
                {formError && (
                  <div style={{ padding: '0.6rem 0.8rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.85rem' }}>
                    {formError}
                  </div>
                )}

                <div className="tt-form-group">
                  <label className="tt-form-label" htmlFor="modalSlotLabel">
                    Slot Label / Description (Optional)
                  </label>
                  <input
                    id="modalSlotLabel"
                    type="text"
                    className="tt-form-input"
                    placeholder="e.g. Slot 1, Morning Lecture"
                    value={slotForm.label}
                    onChange={(e) => setSlotForm({ ...slotForm, label: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalStartTime">
                      Start Time <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="modalStartTime"
                      type="time"
                      required
                      className="tt-form-input"
                      value={slotForm.startTime}
                      onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                    />
                  </div>

                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalEndTime">
                      End Time <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="modalEndTime"
                      type="time"
                      required
                      className="tt-form-input"
                      value={slotForm.endTime}
                      onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <span className="tt-form-hint">
                  Time format must be 24-hour (HH:mm). Start time must precede end time.
                </span>
              </div>

              <div className="tt-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSlotId ? 'Update Slot' : 'Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Dependent Activities */}
      {deleteConfirm && (
        <div className="tt-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="tt-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tt-modal-header" style={{ borderBottomColor: '#fecaca', backgroundColor: '#fff5f5' }}>
              <h3 style={{ color: '#991b1b' }}>Dependent Activities Detected</h3>
              <button
                type="button"
                className="tt-modal-close"
                onClick={() => setDeleteConfirm(null)}
              >
                &times;
              </button>
            </div>

            <div className="tt-modal-body">
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#1f2937' }}>
                Removing slot <strong>{deleteConfirm.slot.label || deleteConfirm.slot.slotId}</strong> ({deleteConfirm.slot.startTime}–{deleteConfirm.slot.endTime}) will affect <strong>{deleteConfirm.affectedCount}</strong> scheduled activity(ies):
              </p>
              <div style={{ padding: '0.6rem 0.85rem', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', fontSize: '0.85rem', color: '#7f1d1d' }}>
                {deleteConfirm.affectedTitles}
                {deleteConfirm.affectedCount > 3 ? '...' : ''}
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563' }}>
                To maintain database integrity, deleting this slot will also remove these dependent activities. Would you like to proceed?
              </p>
            </div>

            <div className="tt-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Keep Slot
              </button>
              <button
                type="button"
                className="btn btn-danger-outline"
                style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                onClick={() => performDelete(deleteConfirm.slot.slotId)}
              >
                Yes, Delete Slot & Activities
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSlotManager;
