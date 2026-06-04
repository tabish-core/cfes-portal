import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import '../dean/Dashboard.css';

/**
 * Checklist data structure.
 * Each item has: id, name, formType (for navigation), and completed state.
 * Separators and group headers are represented with special types.
 */
const INITIAL_CHECKLIST = [
  // Main documents
  { id: 1,  type: 'item', name: 'Course Information Sheet', formType: 'CIS' },
  { id: 2,  type: 'item', name: 'Weekly Plan', formType: 'WP' },
  { id: 3,  type: 'item', name: 'Course Control Report', formType: 'CCR' },
  { id: 4,  type: 'item', name: 'Timetable with consulting hours', formType: 'TIMETABLE' },
  { id: 5,  type: 'item', name: 'Attendance Record', formType: 'AR' },
  { id: 6,  type: 'item', name: 'Lectures', formType: 'LECTURES' },

  // Separator
  { id: 's1', type: 'separator', label: 'Attach Page Separator here' },

  // Assessment Record (grouped)
  { id: 7,  type: 'group-header', name: 'Assessment Record' },
  { id: '7a', type: 'sub-item', name: 'Question Paper, Model Solution, Quizzes', formType: 'ASSESS_QUIZ' },
  { id: '7b', type: 'sub-item', name: 'Assignments', formType: 'ASSESS_ASSIGN' },
  { id: '7c', type: 'sub-item', name: 'Midterm', formType: 'ASSESS_MID' },
  { id: '7d', type: 'sub-item', name: 'Final Exam', formType: 'ASSESS_FINAL' },
  { id: '7e', type: 'sub-item', name: 'CCP/Class Project/PBL', formType: 'ASSESS_PROJECT' },

  // Separator
  { id: 's2', type: 'separator', label: 'Attach Page Separator here' },

  // Remaining items
  { id: 8,  type: 'item', name: 'Course Completion Certificate', formType: 'CCC' },
  { id: 9,  type: 'item', name: 'Final Marks and Grade Report', formType: 'FMGR' },
  { id: 10, type: 'item', name: 'Record of CLO assessment', formType: 'CLO' },
  { id: 11, type: 'item', name: 'Record of GA assessment', formType: 'GA' },
  { id: 12, type: 'item', name: 'Course Review Report', formType: 'CRR' },

  // Separator
  { id: 's3', type: 'separator', label: 'Attach Page Separator here' },

  { id: 13, type: 'item', name: 'Detail of technology involved', formType: 'TECH' },
  { id: 14, type: 'item', name: 'Design skills practiced', formType: 'DESIGN' },
  { id: 15, type: 'item', name: 'Course effectiveness analysis', formType: 'CEA' },
];

const CourseFileChecklist = () => {
  const { courseId } = useParams();

  const [courseInfo, setCourseInfo] = useState({
    courseTitle: '',
    courseCode: '',
    batch: '',
  });

  // Build initial completed state from checklist items
  const [checklist, setChecklist] = useState(() =>
    INITIAL_CHECKLIST.map((item) => ({
      ...item,
      completed: false,
    }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch existing checklist on mount
  useEffect(() => {
    if (!courseId) return;

    const fetchChecklist = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/checklist/${courseId}`);
        if (data.data && data.data.checklist) {
          const saved = data.data.checklist;
          if (saved.courseTitle || saved.courseCode || saved.batch) {
            setCourseInfo({
              courseTitle: saved.courseTitle || '',
              courseCode: saved.courseCode || '',
              batch: saved.batch || '',
            });
          }
          if (saved.checklistItems && saved.checklistItems.length > 0) {
            // Merge saved completion states into the UI checklist structure
            setChecklist((prev) =>
              prev.map((item) => {
                if (item.type === 'separator' || item.type === 'group-header') return item;
                const match = saved.checklistItems.find((s) => s.type === item.formType);
                return match ? { ...item, completed: match.completed } : item;
              })
            );
          }
        }
      } catch (err) {
        setError('Failed to load checklist.');
      } finally {
        setLoading(false);
      }
    };
    fetchChecklist();
  }, [courseId]);

  const handleCourseInfoChange = (field, value) => {
    setCourseInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggle = (id) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    try {
      setLoading(true);
      // Build checklistItems array for the backend (only checkable items)
      const checklistItems = checklist
        .filter((item) => item.type === 'item' || item.type === 'sub-item')
        .map((item) => ({
          name: item.name,
          type: item.formType,
          completed: item.completed,
        }));

      await api.post('/checklist', {
        courseId,
        courseTitle: courseInfo.courseTitle,
        courseCode: courseInfo.courseCode,
        batch: courseInfo.batch,
        checklistItems,
      });
      setSuccess('Checklist saved successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save checklist.');
    } finally {
      setLoading(false);
    }
  };

  // Serial number counter for display
  let serialNo = 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header-container">
        <Link to="/faculty/dashboard" className="back-link">
          ← Back to Courses
        </Link>
        <h1 className="dashboard-heading">Course File Checklist</h1>
        <p className="dashboard-sub">Track all required course documents.</p>
      </div>

      {error && <div style={{ color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: '500', fontSize: '0.9rem' }}>{error}</div>}
      {success && <div style={{ color: '#15803d', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: '500', fontSize: '0.9rem' }}>{success}</div>}
      {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', fontStyle: 'italic', color: '#64748b' }}>Processing...</div>}

      {/* Course Info Fields */}
      <div className="dashboard-panel" style={{ marginBottom: '1.5rem' }}>
        <h2 className="dashboard-section-title">Course Details</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{
              marginBottom: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#475569'
            }}>
              Course Title
            </label>
            <input
              type="text"
              value={courseInfo.courseTitle}
              onChange={(e) => handleCourseInfoChange('courseTitle', e.target.value)}
              placeholder="Enter Course Title"
              style={{
                padding: '0.6rem 0.8rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                borderRadius: '6px',
                fontSize: '0.95rem',
                outline: 'none',
                colorScheme: 'light'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{
              marginBottom: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#475569'
            }}>
              Course Code
            </label>
            <input
              type="text"
              value={courseInfo.courseCode}
              onChange={(e) => handleCourseInfoChange('courseCode', e.target.value)}
              placeholder="Enter Course Code"
              style={{
                padding: '0.6rem 0.8rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                borderRadius: '6px',
                fontSize: '0.95rem',
                outline: 'none',
                colorScheme: 'light'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{
              marginBottom: '0.35rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#475569'
            }}>
              Batch
            </label>
            <input
              type="text"
              value={courseInfo.batch}
              onChange={(e) => handleCourseInfoChange('batch', e.target.value)}
              placeholder="e.g., Fall 2024"
              style={{
                padding: '0.6rem 0.8rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                borderRadius: '6px',
                fontSize: '0.95rem',
                outline: 'none',
                colorScheme: 'light'
              }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Table */}
      <div className="dashboard-panel">
        <h2 className="dashboard-section-title">Document Checklist</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.9rem'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                <th style={{
                  padding: '0.75rem 1rem',
                  border: '1px solid #e2e8f0',
                  fontWeight: '700',
                  color: '#0f172a',
                  width: '80px'
                }}>
                  S.No
                </th>
                <th style={{
                  padding: '0.75rem 1rem',
                  border: '1px solid #e2e8f0',
                  fontWeight: '700',
                  color: '#0f172a'
                }}>
                  Item Name
                </th>
                <th style={{
                  padding: '0.75rem 1rem',
                  border: '1px solid #e2e8f0',
                  fontWeight: '700',
                  color: '#0f172a',
                  width: '100px',
                  textAlign: 'center'
                }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((item) => {
                // Separator row
                if (item.type === 'separator') {
                  return (
                    <tr key={item.id} style={{ backgroundColor: '#fef3c7' }}>
                      <td
                        colSpan={3}
                        style={{
                          padding: '0.75rem 1rem',
                          border: '1px solid #e2e8f0',
                          textAlign: 'center',
                          fontWeight: '600',
                          color: '#92400e',
                          fontStyle: 'italic',
                          fontSize: '0.85rem'
                        }}
                      >
                        {item.label}
                      </td>
                    </tr>
                  );
                }

                // Group header row (e.g., "Assessment Record")
                if (item.type === 'group-header') {
                  serialNo++;
                  return (
                    <tr key={item.id} style={{ backgroundColor: '#f8fafc' }}>
                      <td style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#334155'
                      }}>
                        {serialNo}
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                        fontWeight: '700',
                        color: '#1e293b'
                      }}>
                        {item.name}
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center'
                      }}>
                        {/* No checkbox for group header */}
                      </td>
                    </tr>
                  );
                }

                // Sub-item row (indented, under a group)
                if (item.type === 'sub-item') {
                  return (
                    <tr key={item.id}>
                      <td style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '0.85rem'
                      }}>
                        —
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                        paddingLeft: '2.5rem',
                        color: '#334155'
                      }}>
                        <Link
                          to={`/course/${courseId}/form/${item.formType}`}
                          style={{
                            color: '#3949ab',
                            textDecoration: 'none',
                            fontWeight: '500'
                          }}
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center'
                      }}>
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggle(item.id)}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                            accentColor: '#3949ab'
                          }}
                        />
                      </td>
                    </tr>
                  );
                }

                // Regular item row
                serialNo++;
                return (
                  <tr key={item.id}>
                    <td style={{
                      padding: '0.75rem 1rem',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                      fontWeight: '600',
                      color: '#334155'
                    }}>
                      {serialNo}
                    </td>
                    <td style={{
                      padding: '0.75rem 1rem',
                      border: '1px solid #e2e8f0',
                      color: '#334155'
                    }}>
                      <Link
                        to={`/course/${courseId}/form/${item.formType}`}
                        style={{
                          color: '#3949ab',
                          textDecoration: 'none',
                          fontWeight: '500'
                        }}
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td style={{
                      padding: '0.75rem 1rem',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center'
                    }}>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggle(item.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#3949ab'
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Save Button */}
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#3949ab',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Saving...' : 'Save Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseFileChecklist;
