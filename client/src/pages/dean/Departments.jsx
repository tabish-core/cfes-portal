import { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import Icon from '../../components/common/Icon';
import './Departments.css';

const Departments = () => {
  const toast = useToast();

  // ── Master Data State ──
  const [departments, setDepartments] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── Search & Filter State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [hodFilter, setHodFilter] = useState('ALL'); // 'ALL' | 'assigned' | 'vacant'

  // ── HoD Assignment Modal State ──
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [activeDept, setActiveDept] = useState(null);
  const [selectedHodId, setSelectedHodId] = useState('');
  const [facultySearchTerm, setFacultySearchTerm] = useState('');
  const [savingHod, setSavingHod] = useState(false);

  // ── Remove HoD Confirmation Modal State ──
  const [removalModalOpen, setRemovalModalOpen] = useState(false);
  const [deptForRemoval, setDeptForRemoval] = useState(null);
  const [removingHod, setRemovingHod] = useState(false);

  // ── 1. Fetch Master Data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [depRes, facRes] = await Promise.all([
        api.get('/departments'),
        api.get('/users/faculty'),
      ]);

      const depts = depRes.data?.data?.departments || [];
      const facs = facRes.data?.data?.faculties || [];

      setDepartments(depts);
      setFaculties(facs);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load department data.';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── 2. Filtered Departments ──
  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) => {
      // 1. HoD status filter
      if (hodFilter === 'assigned' && !dept.hod) return false;
      if (hodFilter === 'vacant' && dept.hod) return false;

      // 2. Search query (name or code)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (dept.name || '').toLowerCase();
        const code = (dept.code || '').toLowerCase();
        const hodName = (dept.hod?.name || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !hodName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [departments, hodFilter, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== '' || hodFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setHodFilter('ALL');
  };

  // ── 3. HoD Assignment Handlers ──
  const handleOpenAssignModal = (dept) => {
    setActiveDept(dept);
    setSelectedHodId(dept.hod?._id || '');
    setFacultySearchTerm('');
    setAssignmentModalOpen(true);
  };

  const handleCloseAssignModal = () => {
    if (savingHod) return;
    setAssignmentModalOpen(false);
    setActiveDept(null);
    setSelectedHodId('');
    setFacultySearchTerm('');
  };

  const filteredFacultyOptions = useMemo(() => {
    if (!facultySearchTerm.trim()) return faculties;
    const q = facultySearchTerm.toLowerCase().trim();
    return faculties.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const email = (f.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [faculties, facultySearchTerm]);

  const handleSaveHod = async () => {
    if (!activeDept) return;

    setSavingHod(true);
    try {
      const hodId = selectedHodId || null;
      await api.put(`/departments/${activeDept._id}/hod`, { hodId });

      toast.success(
        hodId
          ? `Head of Department assigned for ${activeDept.name}.`
          : `Head of Department removed for ${activeDept.name}.`
      );

      handleCloseAssignModal();
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update department HoD.');
    } finally {
      setSavingHod(false);
    }
  };

  // ── 4. Dedicated Remove HoD Confirmation Handlers ──
  const handleOpenRemovalModal = (dept) => {
    setDeptForRemoval(dept);
    setRemovalModalOpen(true);
  };

  const handleCloseRemovalModal = () => {
    if (removingHod) return;
    setRemovalModalOpen(false);
    setDeptForRemoval(null);
  };

  const handleConfirmRemoval = async () => {
    if (!deptForRemoval) return;

    setRemovingHod(true);
    try {
      await api.put(`/departments/${deptForRemoval._id}/hod`, { hodId: null });
      toast.success(`Head of Department removed for ${deptForRemoval.name}.`);
      handleCloseRemovalModal();
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove HoD.');
    } finally {
      setRemovingHod(false);
    }
  };

  // ── Stats Summary ──
  const totalCount = departments.length;
  const assignedCount = departments.filter((d) => d.hod).length;
  const vacantCount = totalCount - assignedCount;

  return (
    <div className="departments-page">
      {/* ── Page Header ── */}
      <div className="departments-header">
        <div>
          <h1 className="departments-heading">Department Management</h1>
          <p className="departments-sub">
            Review university academic departments and designate Heads of Department (HoD).
          </p>
        </div>

        {/* Statistical Summary Pills */}
        <div className="departments-header-stats">
          <div className="departments-stat-pill">
            <span className="departments-stat-label">Total</span>
            <span className="departments-stat-val">{totalCount}</span>
          </div>
          <div className="departments-stat-pill departments-stat-pill--assigned">
            <span className="departments-stat-label">HoD Assigned</span>
            <span className="departments-stat-val">{assignedCount}</span>
          </div>
          {vacantCount > 0 && (
            <div className="departments-stat-pill departments-stat-pill--vacant">
              <span className="departments-stat-label">Vacant</span>
              <span className="departments-stat-val">{vacantCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Search and Filter Controls Card ── */}
      <div className="departments-card departments-filters-card">
        <div className="departments-filters-grid">
          {/* Search Box */}
          <div className="departments-filter-group departments-search-group">
            <label className="departments-filter-label" htmlFor="dept-search">
              Search Departments
            </label>
            <input
              id="dept-search"
              type="text"
              className="departments-filter-input"
              placeholder="Search by code, department name, or HoD..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* HoD Assignment Status Filter */}
          <div className="departments-filter-group">
            <label className="departments-filter-label" htmlFor="filter-hod-status">
              HoD Status
            </label>
            <select
              id="filter-hod-status"
              className="departments-filter-select"
              value={hodFilter}
              onChange={(e) => setHodFilter(e.target.value)}
            >
              <option value="ALL">All Departments</option>
              <option value="assigned">HoD Assigned</option>
              <option value="vacant">Vacant / Unassigned</option>
            </select>
          </div>
        </div>

        {/* Summary & Reset Bar */}
        <div className="departments-summary-bar">
          <span className="departments-summary-count">
            Showing <strong>{filteredDepartments.length}</strong> of{' '}
            <strong>{totalCount}</strong> academic departments
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              className="departments-reset-btn"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Main Departments Table Card ── */}
      <div className="departments-card departments-table-card">
        {loading ? (
          <div className="departments-loading-state">
            <span className="departments-spinner">
              <Icon name="spinner" size={24} />
            </span>
            <p>Loading academic departments...</p>
          </div>
        ) : loadError ? (
          <div className="departments-error-state">
            <p className="departments-error-text">{loadError}</p>
            <Button variant="secondary" size="sm" onClick={fetchData}>
              Retry
            </Button>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="departments-empty-state">
            <p className="departments-empty-title">
              {hasActiveFilters
                ? 'No departments match the selected filters.'
                : 'No academic departments found in the system.'}
            </p>
            {hasActiveFilters && (
              <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                Clear All Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="departments-table-wrap">
            <table className="departments-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Code</th>
                  <th style={{ width: '30%' }}>Department Name</th>
                  <th style={{ width: '32%' }}>Head of Department (HoD)</th>
                  <th style={{ width: '12%' }}>Status</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDepartments.map((dept) => {
                  const hasHod = Boolean(dept.hod);

                  return (
                    <tr key={dept._id} className="departments-table-row">
                      {/* Code */}
                      <td>
                        <span className="departments-code-chip">{dept.code}</span>
                      </td>

                      {/* Name */}
                      <td>
                        <div className="departments-name-cell">
                          <span className="departments-name-title">{dept.name}</span>
                        </div>
                      </td>

                      {/* Current HoD */}
                      <td>
                        {hasHod ? (
                          <div className="departments-hod-cell">
                            <span className="departments-hod-name">{dept.hod.name}</span>
                            {dept.hod.email && (
                              <span className="departments-hod-email">{dept.hod.email}</span>
                            )}
                          </div>
                        ) : (
                          <span className="departments-vacant-badge">
                            Vacant (No HoD Assigned)
                          </span>
                        )}
                      </td>

                      {/* Department Status */}
                      <td>
                        <StatusBadge
                          status={dept.isActive !== false ? 'active' : 'inactive'}
                          label={dept.isActive !== false ? 'Active' : 'Inactive'}
                          size="sm"
                        />
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="departments-action-buttons">
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => handleOpenAssignModal(dept)}
                            id={`btn-assign-hod-${dept._id}`}
                          >
                            {hasHod ? 'Change HoD' : 'Assign HoD'}
                          </Button>

                          {hasHod && (
                            <Button
                              variant="danger-subtle"
                              size="sm"
                              onClick={() => handleOpenRemovalModal(dept)}
                              id={`btn-remove-hod-${dept._id}`}
                              title="Unassign current HoD"
                            >
                              Remove
                            </Button>
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

      {/* ── Assign / Reassign HoD Modal ── */}
      <Modal
        isOpen={assignmentModalOpen}
        onClose={handleCloseAssignModal}
        title={activeDept?.hod ? 'Reassign Head of Department' : 'Assign Head of Department'}
        size="md"
        footer={
          <div className="departments-modal-footer">
            <Button
              variant="ghost"
              onClick={handleCloseAssignModal}
              disabled={savingHod}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveHod}
              isLoading={savingHod}
              disabled={savingHod || (activeDept && selectedHodId === (activeDept.hod?._id || ''))}
              id="btn-confirm-save-hod"
            >
              {selectedHodId ? 'Save HoD Assignment' : 'Save (Set Vacant)'}
            </Button>
          </div>
        }
      >
        {activeDept && (
          <div className="departments-dialog-body">
            {/* Department Context Card */}
            <div className="departments-context-card">
              <div className="departments-context-header">
                <div>
                  <span className="departments-code-chip">{activeDept.code}</span>
                  <h4 className="departments-context-title">{activeDept.name}</h4>
                </div>
                <div className="departments-context-status">
                  <StatusBadge
                    status={activeDept.hod ? 'active' : 'warning'}
                    label={activeDept.hod ? 'HoD Assigned' : 'Vacant'}
                    size="sm"
                  />
                </div>
              </div>

              <div className="departments-context-meta">
                <span>
                  Current HoD:{' '}
                  <strong>{activeDept.hod ? activeDept.hod.name : 'None (Vacant)'}</strong>
                </span>
                {activeDept.hod?.email && (
                  <span className="departments-meta-email">({activeDept.hod.email})</span>
                )}
              </div>
            </div>

            {/* Selection Field */}
            <div className="departments-dialog-form">
              <div className="departments-field-group">
                <label className="departments-field-label" htmlFor="modal-faculty-select">
                  Select New Head of Department
                </label>

                {/* Search filter for faculty options */}
                <input
                  type="text"
                  className="departments-filter-subinput"
                  placeholder="Filter eligible faculty by name/email..."
                  value={facultySearchTerm}
                  onChange={(e) => setFacultySearchTerm(e.target.value)}
                  disabled={savingHod}
                />

                <select
                  id="modal-faculty-select"
                  className="departments-field-select"
                  value={selectedHodId}
                  onChange={(e) => setSelectedHodId(e.target.value)}
                  disabled={savingHod}
                >
                  <option value="">-- No HoD (Leave Vacant) --</option>
                  {filteredFacultyOptions.map((fac) => (
                    <option key={fac._id} value={fac._id}>
                      {fac.name} ({fac.email}) — [{fac.designation}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Institutional Notice */}
              <div className="departments-info-notice" role="note">
                <p>
                  <strong>Institutional Rules:</strong>
                </p>
                <ul>
                  <li>
                    Assigning a faculty member will set their institutional role to <strong>HoD</strong>{' '}
                    and associate their account with <strong>{activeDept.name}</strong>.
                  </li>
                  {activeDept.hod && selectedHodId !== activeDept.hod._id && (
                    <li>
                      The current HoD (<strong>{activeDept.hod.name}</strong>) will have their designation
                      automatically reverted back to <strong>Faculty</strong>.
                    </li>
                  )}
                  <li>Course offerings and faculty audit histories are preserved.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Remove HoD Confirmation Modal ── */}
      <Modal
        isOpen={removalModalOpen}
        onClose={handleCloseRemovalModal}
        title="Confirm Removal of Head of Department"
        size="md"
        footer={
          <div className="departments-modal-footer">
            <Button
              variant="ghost"
              onClick={handleCloseRemovalModal}
              disabled={removingHod}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRemoval}
              isLoading={removingHod}
              id="btn-confirm-remove-hod-modal"
            >
              Remove HoD
            </Button>
          </div>
        }
      >
        {deptForRemoval && (
          <div className="departments-dialog-body">
            <div className="departments-removal-warning-banner" role="alert">
              <div className="departments-warning-icon">
                <Icon name="alert" size={20} />
              </div>
              <div className="departments-warning-text">
                <h4>Are you sure you want to remove the Head of Department?</h4>
                <p>
                  This action will unassign the current HoD from <strong>{deptForRemoval.name}</strong>.
                </p>
              </div>
            </div>

            <div className="departments-removal-details-card">
              <div className="departments-detail-row">
                <span className="departments-detail-label">Department</span>
                <span className="departments-detail-val">
                  <strong>{deptForRemoval.code}</strong> — {deptForRemoval.name}
                </span>
              </div>
              <div className="departments-detail-row">
                <span className="departments-detail-label">Current HoD</span>
                <span className="departments-detail-val">
                  {deptForRemoval.hod?.name} ({deptForRemoval.hod?.email})
                </span>
              </div>
            </div>

            <div className="departments-info-notice">
              <p>
                <strong>System Safeguards:</strong>
              </p>
              <ul>
                <li>
                  {deptForRemoval.hod?.name}&apos;s role will revert from <strong>HoD</strong> to{' '}
                  <strong>Faculty</strong>.
                </li>
                <li>The user account will remain active; no files or submissions will be deleted.</li>
                <li>The department will be marked vacant until a new HoD is appointed.</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Departments;
