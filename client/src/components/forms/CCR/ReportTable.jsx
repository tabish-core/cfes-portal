import React from 'react';

const ACTIVITY_OPTIONS = ['Q', 'A', 'P', 'MT', 'FE'];

const ReportTable = ({ data, onChange, onAddTopic, onRemoveTopic, title, rowLabelPrefix, rowLabelField, showSpecialRows }) => {
  const cellStyle = {
    padding: '0.6rem 0.4rem',
    border: '1px solid #cbd5e1',
    color: '#334155',
    fontSize: '0.85rem',
    verticalAlign: 'middle'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.4rem',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    borderRadius: '4px',
    fontSize: '0.85rem',
    boxSizing: 'border-box',
    outline: 'none'
  };

  // Pre-calculate spans for Week No and Duration (only for weekly report)
  const weekSpans = {};
  if (showSpecialRows) {
    data.forEach(row => {
      if (!row.isSpecialRow && row.weekNo) {
        weekSpans[row.weekNo] = (weekSpans[row.weekNo] || 0) + 1;
      }
    });
  }

  const renderedWeeks = new Set();

  return (
    <div className="report-table-section" style={{ marginTop: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', backgroundColor: '#f1f5f9', padding: '0.75rem', border: '1px solid #cbd5e1' }}>
        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem', fontWeight: '600' }}>
          {title}
        </h3>
        {!showSpecialRows && onAddTopic && (
          <button 
            type="button" 
            onClick={() => onAddTopic()}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#3949ab', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
          >+ Add Row</button>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th style={{ ...cellStyle, fontWeight: '700', width: '80px' }}>{rowLabelPrefix} No.</th>
              <th style={{ ...cellStyle, fontWeight: '700', width: '140px' }}>Schedule Date</th>
              <th style={{ ...cellStyle, fontWeight: '700', width: '100px' }}>Time In</th>
              <th style={{ ...cellStyle, fontWeight: '700', width: '100px' }}>Time Out</th>
              <th style={{ ...cellStyle, fontWeight: '700', minWidth: '250px' }}>Topic Covered</th>
              <th style={{ ...cellStyle, fontWeight: '700', width: '100px' }}>*Q/A/CP/ MT/FE</th>
              <th style={{ ...cellStyle, fontWeight: '700', width: '80px' }}>Duration</th>
              <th style={{ ...cellStyle, fontWeight: '700', width: '120px' }}>Signature</th>
              <th style={{ ...cellStyle, fontWeight: '700', width: '150px' }}>Remarks</th>
              {onRemoveTopic && <th style={{ ...cellStyle, width: '40px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              if (row.isSpecialRow) {
                return (
                  <tr key={`special-${index}`} style={{ backgroundColor: '#e2e8f0' }}>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>{row.weekNo}</td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      <input type="date" value={row.scheduleDate} onChange={(e) => onChange(index, 'scheduleDate', e.target.value)} style={inputStyle} />
                    </td>
                    <td colSpan={3} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>{row.specialRowText}</td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      <input type="text" value={row.activityType} onChange={(e) => onChange(index, 'activityType', e.target.value)} style={{...inputStyle, textAlign: 'center', fontWeight: 'bold'}} />
                    </td>
                    <td colSpan={3} style={cellStyle}></td>
                    {onRemoveTopic && <td style={cellStyle}></td>}
                  </tr>
                );
              }

              const weekNo = row.weekNo;
              const isFirstInWeek = showSpecialRows ? !renderedWeeks.has(weekNo) : true;
              if (showSpecialRows && isFirstInWeek) renderedWeeks.add(weekNo);

              return (
                <tr key={`${rowLabelPrefix}-${index}`}>
                  {isFirstInWeek ? (
                    <td rowSpan={showSpecialRows ? (weekSpans[weekNo] || 1) : 1} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                      {showSpecialRows ? weekNo : row[rowLabelField]}
                      {showSpecialRows && onAddTopic && (
                        <div style={{ marginTop: '5px' }}>
                          <button 
                            type="button" 
                            onClick={() => onAddTopic(weekNo)}
                            style={{ padding: '2px 6px', fontSize: '10px', cursor: 'pointer', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '3px' }}
                          >+ row</button>
                        </div>
                      )}
                    </td>
                  ) : null}
                  
                  <td style={cellStyle}>
                    <input type="date" value={row.scheduleDate} onChange={(e) => onChange(index, 'scheduleDate', e.target.value)} style={inputStyle} />
                  </td>
                  <td style={cellStyle}>
                    <input type="time" value={row.timeIn} onChange={(e) => onChange(index, 'timeIn', e.target.value)} style={inputStyle} />
                  </td>
                  <td style={cellStyle}>
                    <input type="time" value={row.timeOut} onChange={(e) => onChange(index, 'timeOut', e.target.value)} style={inputStyle} />
                  </td>
                  <td style={cellStyle}>
                    <input type="text" value={row.topicCovered} onChange={(e) => onChange(index, 'topicCovered', e.target.value)} style={inputStyle} />
                  </td>
                  <td style={cellStyle}>
                    <input type="text" value={row.activityType} onChange={(e) => onChange(index, 'activityType', e.target.value)} style={{...inputStyle, textAlign: 'center'}} />
                  </td>

                  {(isFirstInWeek || !showSpecialRows) ? (
                    <td rowSpan={showSpecialRows ? (weekSpans[weekNo] || 1) : 1} style={{ ...cellStyle, textAlign: 'center' }}>
                      <input type="text" value={row.duration} onChange={(e) => onChange(index, 'duration', e.target.value)} style={{...inputStyle, textAlign: 'center', fontWeight: 'bold'}} />
                    </td>
                  ) : null}

                  <td style={cellStyle}>
                    <input type="text" value={row.signature} onChange={(e) => onChange(index, 'signature', e.target.value)} style={inputStyle} />
                  </td>
                  <td style={cellStyle}>
                    <input type="text" value={row.remarks} onChange={(e) => onChange(index, 'remarks', e.target.value)} style={inputStyle} />
                  </td>
                  
                  {onRemoveTopic && (
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      <button 
                        type="button" 
                        onClick={() => onRemoveTopic(index)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}
                      >x</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportTable;
