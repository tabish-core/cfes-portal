import React from 'react';
import Icon from '../../common/Icon';

/**
 * DeliverablesSection — Checklist of deliverables required for the CCP report/project.
 */
const DeliverablesSection = ({ deliverables, onChange }) => {
  const items = deliverables?.items || [];
  const heading = deliverables?.heading || 'Report (must include)';

  const handleHeadingChange = (value) => {
    onChange({ ...deliverables, heading: value });
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...deliverables, items: updated });
  };

  const handleAddItem = () => {
    const newItem = { label: '', required: true, completed: false };
    onChange({ ...deliverables, items: [...items, newItem] });
  };

  const handleRemoveItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    onChange({ ...deliverables, items: updated });
  };

  return (
    <section className="cfes-ccp-card" aria-labelledby="ccp-deliverables-heading">
      <div className="cfes-ccp-card-header">
        <h2 id="ccp-deliverables-heading" className="cfes-ccp-card-title">
          <Icon name="check" size={18} />
          <span>Section D: Deliverables &amp; Report Items</span>
        </h2>
        <span className="cfes-ccp-card-tag">Student Submission Checklist</span>
      </div>

      <div className="cfes-ccp-deliverables-header-row">
        <div className="cfes-ccp-deliverables-input-wrap">
          <label htmlFor="ccp-deliverable-heading" className="cfes-ccp-label">
            Deliverable Category / Report Heading:
          </label>
          <input
            id="ccp-deliverable-heading"
            type="text"
            value={heading}
            onChange={(e) => handleHeadingChange(e.target.value)}
            placeholder="e.g., Report (must include)"
            className="cfes-ccp-input"
            aria-label="Deliverable Category or Heading"
          />
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          className="cfes-ccp-add-btn"
          aria-label="Add deliverable item to checklist"
        >
          <span>+ Add Deliverable Item</span>
        </button>
      </div>

      <div
        className="cfes-table-scroll-container"
        tabIndex={0}
        aria-label="Project deliverables and report checklist items"
        style={{
          overflowX: 'auto',
          width: '100%',
          maxWidth: '100%',
          WebkitOverflowScrolling: 'touch',
          border: '1px solid var(--cfes-slate-300)',
          borderRadius: 'var(--cfes-radius-lg)',
        }}
      >
        <table className="cfes-crr-table" style={{ minWidth: '500px' }}>
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
              <th style={{ minWidth: '320px' }}>Deliverable Item Description</th>
              <th style={{ width: '70px', textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--cfes-slate-500)' }}>
                  {index + 1}
                </td>
                <td>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                    placeholder="Enter deliverable description..."
                    className="cfes-ccp-input"
                    aria-label={`Deliverable item description ${index + 1}`}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    title="Remove item"
                    className="cfes-ccp-delete-btn"
                    aria-label={`Remove deliverable item ${index + 1}`}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DeliverablesSection;
