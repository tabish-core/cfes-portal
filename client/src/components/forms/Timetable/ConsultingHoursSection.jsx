import React, { useState } from 'react';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const timeToMinutes = (t) => {
  if (!t || typeof t !== 'string') return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const ConsultingHoursSection = ({
  consultingHours = [],
  onChangeConsultingHours,
  validationErrors = []
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formState, setFormState] = useState({
    id: '',
    day: 'Monday',
    startTime: '14:00',
    endTime: '15:30',
    location: '',
    notes: '',
  });

  const [formError, setFormError] = useState('');

  const handleOpenAdd = () => {
    setFormState({
      id: `ch_${Date.now()}`,
      day: 'Monday',
      startTime: '14:00',
      endTime: '15:30',
      location: '',
      notes: '',
    });
    setFormError('');
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ch) => {
    setFormState({
      id: ch.id,
      day: ch.day,
      startTime: ch.startTime,
      endTime: ch.endTime,
      location: ch.location || '',
      notes: ch.notes || '',
    });
    setFormError('');
    setEditingId(ch.id);
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setFormError('');

    const { id, day, startTime, endTime, location, notes } = formState;

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

    // Check overlaps with other consulting hours on the same day
    const otherOnDay = consultingHours.filter(
      (c) => c.day === day && c.id !== (editingId || id)
    );

    for (const other of otherOnDay) {
      const oStart = timeToMinutes(other.startTime);
      const oEnd = timeToMinutes(other.endTime);
      if (Math.max(startMin, oStart) < Math.min(endMin, oEnd)) {
        setFormError(
          `Time range (${startTime} - ${endTime}) overlaps with another consulting period on ${day} (${other.startTime} - ${other.endTime}).`
        );
        return;
      }
    }

    const cleanCH = {
      id: id || `ch_${Date.now()}`,
      day,
      startTime,
      endTime,
      location: location.trim(),
      notes: notes.trim(),
    };

    let updated;
    if (editingId) {
      updated = consultingHours.map((c) => (c.id === editingId ? cleanCH : c));
    } else {
      updated = [...consultingHours, cleanCH];
    }

    // Sort by day order, then start time
    updated.sort((a, b) => {
      const dayDiff = DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    onChangeConsultingHours(updated);
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to remove this consulting hour slot?')) {
      const updated = consultingHours.filter((c) => c.id !== id);
      onChangeConsultingHours(updated);
    }
  };

  const hasCHError = validationErrors.some(
    (e) => e.field && e.field.startsWith('consultingHours')
  );

  return (
    <div className="tt-section">
      <div className="tt-section-header">
        <div>
          <h2 className="tt-section-title">
            Dedicated Consulting Hours ({consultingHours.length})
          </h2>
          <p className="tt-section-sub">
            Designated office and student consultation slots, maintained separately from teaching activities.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleOpenAdd}
        >
          + Add Consulting Hours
        </button>
      </div>

      {hasCHError && (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}
        >
          {validationErrors
            .filter((e) => e.field && e.field.startsWith('consultingHours'))
            .map((e, idx) => (
              <p key={idx} className="tt-error-text" style={{ margin: '2px 0' }}>
                {e.message}
              </p>
            ))}
        </div>
      )}

      {consultingHours.length === 0 ? (
        <div className="tt-empty-box">
          <p>No dedicated consulting hours configured for this semester.</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenAdd}
          >
            + Add Consulting Hour Slot
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="consulting-hours-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Day</th>
                <th style={{ width: '22%' }}>Time Window</th>
                <th style={{ width: '25%' }}>Location / Room</th>
                <th style={{ width: '26%' }}>Notes / Instructions</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {consultingHours.map((ch) => (
                <tr key={ch.id}>
                  <td>
                    <strong>{ch.day}</strong>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                      {ch.startTime} – {ch.endTime}
                    </span>
                  </td>
                  <td>{ch.location || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                  <td>{ch.notes || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleOpenEdit(ch)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-outline btn-sm"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleDelete(ch.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Consulting Hour Modal */}
      {isModalOpen && (
        <div className="tt-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="tt-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tt-modal-header">
              <h3>
                {editingId ? 'Edit Consulting Hours' : 'Add Consulting Hours'}
              </h3>
              <button
                type="button"
                className="tt-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="tt-modal-body">
                {formError && (
                  <div
                    style={{
                      padding: '0.6rem 0.8rem',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#b91c1c',
                      fontSize: '0.85rem',
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div className="tt-form-group">
                  <label className="tt-form-label" htmlFor="modalCHDay">
                    Day of Week <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    id="modalCHDay"
                    className="tt-form-select"
                    value={formState.day}
                    onChange={(e) =>
                      setFormState({ ...formState, day: e.target.value })
                    }
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                  }}
                >
                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalCHStartTime">
                      Start Time <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="modalCHStartTime"
                      type="time"
                      required
                      className="tt-form-input"
                      value={formState.startTime}
                      onChange={(e) =>
                        setFormState({ ...formState, startTime: e.target.value })
                      }
                    />
                  </div>

                  <div className="tt-form-group">
                    <label className="tt-form-label" htmlFor="modalCHEndTime">
                      End Time <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="modalCHEndTime"
                      type="time"
                      required
                      className="tt-form-input"
                      value={formState.endTime}
                      onChange={(e) =>
                        setFormState({ ...formState, endTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="tt-form-group">
                  <label className="tt-form-label" htmlFor="modalCHLocation">
                    Office / Location
                  </label>
                  <input
                    id="modalCHLocation"
                    type="text"
                    placeholder="e.g. Faculty Office 305, Main Campus"
                    className="tt-form-input"
                    value={formState.location}
                    onChange={(e) =>
                      setFormState({ ...formState, location: e.target.value })
                    }
                  />
                </div>

                <div className="tt-form-group">
                  <label className="tt-form-label" htmlFor="modalCHNotes">
                    Notes / Student Instructions
                  </label>
                  <input
                    id="modalCHNotes"
                    type="text"
                    placeholder="e.g. Open walk-in consultation and FYP advising"
                    className="tt-form-input"
                    value={formState.notes}
                    onChange={(e) =>
                      setFormState({ ...formState, notes: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="tt-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update Consulting Hours' : 'Add Consulting Hours'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultingHoursSection;
