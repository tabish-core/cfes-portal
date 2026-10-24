import React from 'react';

const cellStyle = {
  padding: '0.6rem 0.75rem',
  border: '1px solid #e2e8f0',
  color: '#334155',
  fontSize: '0.88rem',
  verticalAlign: 'middle',
};

const thStyle = {
  ...cellStyle,
  fontWeight: '700',
  color: '#0f172a',
  backgroundColor: '#f1f5f9',
};

const inputStyle = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#1e293b',
  borderRadius: '4px',
  fontSize: '0.88rem',
  boxSizing: 'border-box',
  outline: 'none',
  colorScheme: 'light',
};

const btnStyle = {
  padding: '0.35rem 0.75rem',
  border: 'none',
  borderRadius: '5px',
  fontSize: '0.8rem',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

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
    <div style={{ marginBottom: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '0.5rem',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          Deliverables &amp; Report Items
        </h3>
        <button
          type="button"
          onClick={handleAddItem}
          style={{
            ...btnStyle,
            backgroundColor: '#f1f5f9',
            color: '#3949ab',
            border: '1px solid #c7d2fe',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e0e7ff')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
        >
          + Add Deliverable Item
        </button>
      </div>

      <div style={{ marginBottom: '1rem', maxWidth: '400px' }}>
        <label
          style={{
            marginBottom: '0.3rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            color: '#475569',
            display: 'block',
          }}
        >
          Deliverable Category / Heading
        </label>
        <input
          type="text"
          value={heading}
          onChange={(e) => handleHeadingChange(e.target.value)}
          placeholder="e.g., Report (must include)"
          style={inputStyle}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>#</th>
              <th style={thStyle}>Deliverable Item Description</th>
              <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={{ ...cellStyle, textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                  {index + 1}
                </td>
                <td style={cellStyle}>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => handleItemChange(index, 'label', e.target.value)}
                    placeholder="Enter deliverable description..."
                    style={inputStyle}
                  />
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    title="Remove item"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '1rem',
                      padding: '0 0.25rem',
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeliverablesSection;
