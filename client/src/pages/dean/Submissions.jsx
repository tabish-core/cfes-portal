import { useState, useEffect, useMemo, useCallback } from 'react';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import api from '../../api/axios';
import { getSemesters } from '../../services/semester.service';
import { getOfferingsBySemester } from '../../services/courseOffering.service';
import Icon from '../../components/common/Icon';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import './Submissions.css';

const Submissions = () => {
  const { user } = useAuth();
  const toast = useToast();

  const isHod = user?.designation === 'hod';

  // Core data states
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [offerings, setOfferings] = useState([]);

  // Filter states
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Loading & error states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOfferings, setLoadingOfferings] = useState(false);

  // Read-only audit modal state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedOfferingForAudit, setSelectedOfferingForAudit] = useState(null);
  const [auditChecklist, setAuditChecklist] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');

  // 1. Initial data fetch: Semesters & Departments
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      setLoadingInitial(true);
      try {
        const [semRes, deptRes] = await Promise.all([
          getSemesters(),
          api.get('/departments').catch(() => ({ data: { data: { departments: [] } } })),
        ]);

        if (!isMounted) return;

        const allSemesters = semRes.semesters || [];
        setSemesters(allSemesters);

        const allDepartments = deptRes.data?.data?.departments || [];
        setDepartments(allDepartments);

        // Auto-select active semester by default, or first semester
        const activeSem = allSemesters.find((s) => s.status === 'active');
        if (activeSem) {
          setSelectedSemesterId(activeSem._id);
        } else if (allSemesters.length > 0) {
          setSelectedSemesterId(allSemesters[0]._id);
        }

        // If user is HoD and has an assigned department, default department filter
        if (isHod && user?.department) {
          setSelectedDepartmentId(user.department);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load initial data:', err);
          toast.error('Failed to load semesters or departments.');
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, [isHod, user?.department, toast]);

  // 2. Fetch offerings with progress and drive sync whenever selectedSemesterId changes
  const fetchOfferings = useCallback(async (semId) => {
    if (!semId) {
      setOfferings([]);
      return;
    }
    setLoadingOfferings(true);
    try {
      const data = await getOfferingsBySemester(semId, true);
      setOfferings(data.offerings || []);
    } catch (err) {
      console.error('Failed to load course offerings:', err);
      toast.error(err.response?.data?.message || 'Failed to load course offerings.');
    } finally {
      setLoadingOfferings(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedSemesterId) {
      fetchOfferings(selectedSemesterId);
    }
  }, [selectedSemesterId, fetchOfferings]);

  // 3. Client-side filtering logic
  const filteredOfferings = useMemo(() => {
    return offerings.filter((offering) => {
      // Department filter
      if (selectedDepartmentId) {
        const deptId =
          offering.course?.department?._id ||
          offering.course?.department ||
          offering.faculty?.department?._id ||
          offering.faculty?.department;
        if (!deptId || deptId.toString() !== selectedDepartmentId.toString()) {
          return false;
        }
      }

      // Checklist status filter
      if (statusFilter !== 'ALL') {
        if (offering.progress?.status !== statusFilter) {
          return false;
        }
      }

      // Search filter (Course code, course name, section, faculty name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (offering.course?.courseCode || '').toLowerCase();
        const name = (offering.course?.courseName || '').toLowerCase();
        const section = (offering.section || '').toLowerCase();
        const sectionFull = `section ${section}`;
        const faculty = (offering.faculty?.name || '').toLowerCase();

        const matches =
          code.includes(q) ||
          name.includes(q) ||
          section.includes(q) ||
          sectionFull.includes(q) ||
          faculty.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [offerings, selectedDepartmentId, statusFilter, searchQuery]);

  // 4. Handle Read-Only Checklist Inspection
  const handleOpenAuditModal = async (offering) => {
    setSelectedOfferingForAudit(offering);
    setAuditModalOpen(true);
    setLoadingAudit(true);
    setAuditError('');
    setAuditChecklist(null);

    try {
      const res = await api.get(`/checklist/offering/${offering._id}`);
      setAuditChecklist(res.data?.data?.checklist || null);
    } catch (err) {
      console.error('Failed to load checklist details:', err);
      setAuditError('Failed to load checklist details for this offering.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleCloseAuditModal = () => {
    setAuditModalOpen(false);
    setSelectedOfferingForAudit(null);
    setAuditChecklist(null);
    setAuditError('');
  };

  const handleResetFilters = () => {
    if (!isHod) setSelectedDepartmentId('');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  const selectedSemester = semesters.find((s) => s._id === selectedSemesterId);

  return (
    <div className="submissions-page">
      {/* Page Header */}
      <div className="submissions-header">
        <div>
          <h1 className="submissions-heading">Course File Submissions & Audit</h1>
          <p className="submissions-sub">
            Institutional tracking of course checklist compliance and Google Drive synchronization.
          </p>
        </div>

        {selectedSemester && (
          <div className="submissions-semester-indicator">
            <span className={`submissions-sem-badge ${selectedSemester.status === 'active' ? 'submissions-sem-badge--active' : ''}`}>
              {selectedSemester.name} {selectedSemester.status === 'active' ? '(Active)' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Filter and Control Bar */}
      <div className="submissions-card submissions-filters-card">
        <div className="submissions-filters-grid">
          {/* Semester Selector */}
          <div className="submissions-filter-group">
            <label className="submissions-filter-label" htmlFor="filter-semester">Semester</label>
            <select
              id="filter-semester"
              className="submissions-filter-select"
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              disabled={loadingInitial || semesters.length === 0}
            >
              {semesters.length === 0 ? (
                <option value="">No semesters available</option>
              ) : (
                semesters.map((sem) => (
                  <option key={sem._id} value={sem._id}>
                    {sem.name} {sem.status === 'active' ? '— Active' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Department Selector (Dean: all depts; HoD: locked to their department) */}
          <div className="submissions-filter-group">
            <label className="submissions-filter-label" htmlFor="filter-department">Department</label>
            <select
              id="filter-department"
              className="submissions-filter-select"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              disabled={loadingInitial || isHod}
            >
              {!isHod && <option value="">All Departments</option>}
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          {/* Checklist Status Filter */}
          <div className="submissions-filter-group">
            <label className="submissions-filter-label" htmlFor="filter-status">Compliance Status</label>
            <select
              id="filter-status"
              className="submissions-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="Complete">Complete (100%)</option>
              <option value="In Progress">In Progress (1–99%)</option>
              <option value="Not Started">Not Started (0%)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="submissions-filter-group submissions-filter-group--search">
            <label className="submissions-filter-label" htmlFor="filter-search">Search Offerings</label>
            <div className="submissions-search-wrapper">
              <span className="submissions-search-icon">
                <Icon name="search" size={16} />
              </span>
              <input
                id="filter-search"
                type="text"
                className="submissions-filter-input"
                placeholder="Course code, name, section, faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="submissions-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search query"
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Summary & Reset Action */}
        <div className="submissions-summary-bar">
          <span className="submissions-count-text">
            Showing <strong>{filteredOfferings.length}</strong> of {offerings.length} course offering{offerings.length !== 1 ? 's' : ''}
          </span>
          {(selectedDepartmentId || statusFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              className="submissions-reset-btn"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Tracker Table */}
      <div className="submissions-card submissions-table-card">
        {loadingOfferings ? (
          <div className="submissions-state-box">
            <span className="submissions-spinner">
              <Icon name="spinner" size={24} />
            </span>
            <p>Loading course file submissions...</p>
          </div>
        ) : !selectedSemesterId ? (
          <div className="submissions-state-box">
            <p>Please select an academic semester to view course offerings.</p>
          </div>
        ) : offerings.length === 0 ? (
          <div className="submissions-state-box">
            <p>No course offerings found for {selectedSemester?.name || 'the selected semester'}.</p>
          </div>
        ) : filteredOfferings.length === 0 ? (
          <div className="submissions-state-box">
            <p>No course offerings match the active filter criteria.</p>
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="submissions-table-container">
            <table className="submissions-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Course</th>
                  <th style={{ width: '7%', textAlign: 'center' }}>Section</th>
                  <th style={{ width: '18%' }}>Faculty</th>
                  <th style={{ width: '12%' }}>Department</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Checklist</th>
                  <th style={{ width: '15%' }}>Progress</th>
                  <th style={{ width: '14%' }}>Google Drive</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOfferings.map((offering) => {
                  const completed = offering.progress?.completedCount ?? 0;
                  const total = offering.progress?.totalCount ?? 19;
                  const pct = offering.progress?.completionPercentage ?? 0;
                  const driveSynced = offering.drive?.syncedFilesCount ?? 0;
                  const driveUrl = offering.drive?.folderUrl;

                  const dept =
                    offering.course?.department?.code ||
                    offering.course?.department?.name ||
                    offering.faculty?.department?.code ||
                    '—';

                  return (
                    <tr key={offering._id}>
                      {/* Course Code & Name */}
                      <td>
                        <div className="course-cell">
                          <span className="course-code">{offering.course?.courseCode}</span>
                          <span className="course-title">{offering.course?.courseName}</span>
                        </div>
                      </td>

                      {/* Section */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="section-badge">{offering.section || 'A'}</span>
                      </td>

                      {/* Faculty */}
                      <td>
                        <div className="faculty-cell">
                          <span className="faculty-name">{offering.faculty?.name || 'Unassigned'}</span>
                          {offering.faculty?.email && (
                            <span className="faculty-email">{offering.faculty.email}</span>
                          )}
                        </div>
                      </td>

                      {/* Department */}
                      <td>
                        <span className="dept-tag">{dept}</span>
                      </td>

                      {/* Checklist count */}
                      <td style={{ textAlign: 'center' }}>
                        <span className="checklist-ratio">
                          <strong>{completed}</strong> / {total}
                        </span>
                      </td>

                      {/* Progress bar */}
                      <td>
                        <div className="progress-cell">
                          <div className="progress-track" aria-hidden="true">
                            <div
                              className="progress-fill"
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                          <span className="progress-text">{pct}%</span>
                        </div>
                      </td>

                      {/* Drive sync status */}
                      <td>
                        <div className="drive-cell">
                          <StatusBadge
                            status={offering.drive?.status || 'Not Synced'}
                            size="sm"
                          />
                          {driveSynced > 0 && (
                            <span className="drive-count-sub">
                              {driveSynced} file{driveSynced !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="actions-cell">
                          {/* View Checklist */}
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="view"
                            onClick={() => handleOpenAuditModal(offering)}
                            title="Inspect course checklist in read-only audit mode"
                          >
                            Checklist
                          </Button>

                          {/* Open Drive folder */}
                          {driveUrl ? (
                            <a
                              href={driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cfes-btn cfes-btn--subtle cfes-btn--sm drive-link-btn"
                              title="Open synchronized Google Drive folder in a new tab"
                            >
                              <span className="cfes-btn-icon">
                                <Icon name="external" size={14} />
                              </span>
                              <span>Drive</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              className="cfes-btn cfes-btn--subtle cfes-btn--sm drive-link-disabled"
                              disabled
                              title="No files synchronized to Google Drive yet"
                            >
                              <span className="cfes-btn-icon">
                                <Icon name="external" size={14} />
                              </span>
                              <span>Drive</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Read-Only Checklist Inspection Modal */}
      <Modal
        isOpen={auditModalOpen}
        onClose={handleCloseAuditModal}
        size="lg"
        title="Course File Checklist Audit"
        footer={
          <div className="audit-modal-footer">
            <span className="audit-read-only-notice">
              <Icon name="document" size={16} />
              Read-only administrative inspection view.
            </span>
            <Button variant="secondary" size="md" onClick={handleCloseAuditModal}>
              Close
            </Button>
          </div>
        }
      >
        {selectedOfferingForAudit && (
          <div className="audit-modal-body">
            {/* Header context card */}
            <div className="audit-context-card">
              <div className="audit-context-row">
                <div>
                  <span className="audit-context-code">
                    {selectedOfferingForAudit.course?.courseCode}
                  </span>
                  <h4 className="audit-context-title">
                    {selectedOfferingForAudit.course?.courseName}
                  </h4>
                </div>
                <div className="audit-context-badges">
                  <span className="section-badge">
                    Section {selectedOfferingForAudit.section || 'A'}
                  </span>
                  <span className="audit-sem-badge">
                    {selectedOfferingForAudit.semester?.name}
                  </span>
                </div>
              </div>

              <div className="audit-context-meta">
                <span>Instructor: <strong>{selectedOfferingForAudit.faculty?.name || 'Unassigned'}</strong></span>
                <span>
                  Compliance:{' '}
                  <strong>
                    {selectedOfferingForAudit.progress?.completedCount ?? 0} of{' '}
                    {selectedOfferingForAudit.progress?.totalCount ?? 19} items (
                    {selectedOfferingForAudit.progress?.completionPercentage ?? 0}%)
                  </strong>
                </span>
              </div>
            </div>

            {/* Checklist items list */}
            {loadingAudit ? (
              <div className="audit-loading-state">
                <span className="submissions-spinner">
                  <Icon name="spinner" size={20} />
                </span>
                <p>Loading checklist items...</p>
              </div>
            ) : auditError ? (
              <div className="audit-error-state">
                <p>{auditError}</p>
              </div>
            ) : !auditChecklist || !auditChecklist.checklistItems || auditChecklist.checklistItems.length === 0 ? (
              <div className="audit-empty-state">
                <p>No checklist records have been submitted for this offering yet.</p>
                <span className="dashboard-text-muted">
                  All 19 institutional items remain pending.
                </span>
              </div>
            ) : (
              <div className="audit-checklist-wrap">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>#</th>
                      <th style={{ width: '20%' }}>Form Type</th>
                      <th style={{ width: '50%' }}>Document Title</th>
                      <th style={{ width: '20%', textAlign: 'center' }}>Audit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditChecklist.checklistItems.map((item, idx) => (
                      <tr key={item.type || idx}>
                        <td className="audit-item-index">{idx + 1}</td>
                        <td>
                          <span className="audit-type-chip">{item.type}</span>
                        </td>
                        <td className="audit-item-name">{item.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <StatusBadge
                            variant={item.completed ? 'success' : 'neutral'}
                            label={item.completed ? 'Completed' : 'Pending'}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Submissions;
