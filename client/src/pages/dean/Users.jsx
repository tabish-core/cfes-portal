import { useEffect, useState, useMemo, useCallback } from 'react';
import { getFaculties, registerFaculty, updateFacultyUser } from '../../services/auth.service';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import Icon from '../../components/common/Icon';
import './Users.css';

const initialCreateForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  designation: 'faculty',
  department: '',
};

const initialEditForm = {
  name: '',
  email: '',
  designation: 'faculty',
  department: '',
  password: '',
  confirmPassword: '',
  isActive: true,
};

const Users = () => {
  const toast = useToast();

  // ── Data State ──
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  // ── Filter State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [designationFilter, setDesignationFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // ── Modals State ──
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  // ── Persistent Credential Notice ──
  // Contains { name, email, password, designation, isReset }
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // ── Fetch Data ──
  const fetchFaculties = useCallback(async () => {
    setLoadingList(true);
    setListError('');
    try {
      const { faculties: fetchedFaculties } = await getFaculties();
      setFaculties(fetchedFaculties || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load user accounts.';
      setListError(msg);
      toast.error(msg);
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  const fetchDepartments = useCallback(async () => {
    try {
      const { data } = await api.get('/departments');
      setDepartments(data.data.departments || []);
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  }, []);

  useEffect(() => {
    fetchFaculties();
    fetchDepartments();
  }, [fetchFaculties, fetchDepartments]);

  // ── Filtered Faculties ──
  const filteredFaculties = useMemo(() => {
    return faculties.filter((faculty) => {
      // 1. Designation filter
      if (designationFilter !== 'ALL' && faculty.designation !== designationFilter) {
        return false;
      }

      // 2. Department filter
      if (departmentFilter) {
        const deptId = faculty.department?._id || faculty.department;
        if (!deptId || deptId.toString() !== departmentFilter.toString()) {
          return false;
        }
      }

      // 3. Status filter
      if (statusFilter !== 'ALL') {
        const isActive = !!faculty.isActive;
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;
      }

      // 4. Search query (name or email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (faculty.name || '').toLowerCase();
        const email = (faculty.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [faculties, designationFilter, departmentFilter, statusFilter, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    designationFilter !== 'ALL' ||
    departmentFilter !== '' ||
    statusFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setDesignationFilter('ALL');
    setDepartmentFilter('');
    setStatusFilter('ALL');
  };

  // ── Helper: Department Name Resolver ──
  const getDepartmentLabel = (faculty) => {
    if (!faculty.department) return '—';
    const deptId = faculty.department._id || faculty.department;
    const match = departments.find((d) => d._id === deptId);
    if (match) return `${match.name} (${match.code})`;
    if (faculty.department.name) {
      return faculty.department.code
        ? `${faculty.department.name} (${faculty.department.code})`
        : faculty.department.name;
    }
    return '—';
  };

  // ── Create User Handlers ──
  const handleOpenCreateModal = () => {
    setCreateForm(initialCreateForm);
    setCreateError('');
    setCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    if (creating) return;
    setCreateModalOpen(false);
    setCreateForm(initialCreateForm);
    setCreateError('');
  };

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    // NOTE: Does NOT clear createdCredentials banner so guidance persists!
    setCreateForm((prev) => ({ ...prev, [name]: value }));
    setCreateError('');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (creating) return;

    const name = createForm.name.trim();
    const email = createForm.email.trim().toLowerCase();
    const password = createForm.password;
    const confirmPassword = createForm.confirmPassword;
    const designation = createForm.designation;
    const department = createForm.department;

    if (!name) {
      setCreateError('Full name is required.');
      return;
    }

    if (!email) {
      setCreateError('Email address is required.');
      return;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      setCreateError('Please provide a valid email address.');
      return;
    }

    if (!password) {
      setCreateError('Temporary password is required.');
      return;
    }

    if (password.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setCreateError('Password and confirm password do not match.');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const { user } = await registerFaculty({
        name,
        email,
        password,
        designation,
        department: department || undefined,
      });

      toast.success(`Account created for ${user.name} (${user.email}).`);
      setCreatedCredentials({
        name: user.name,
        email: user.email,
        password,
        designation: user.designation || designation,
        isReset: false,
      });

      setCreateModalOpen(false);
      setCreateForm(initialCreateForm);
      await fetchFaculties();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create user account.';
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // ── Edit User Handlers ──
  const handleOpenEditModal = (faculty) => {
    setSelectedFaculty(faculty);
    setEditForm({
      name: faculty.name || '',
      email: faculty.email || '',
      designation: faculty.designation || 'faculty',
      department: faculty.department?._id || faculty.department || '',
      password: '',
      confirmPassword: '',
      isActive: faculty.isActive !== false,
    });
    setEditError('');
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    if (updating) return;
    setEditModalOpen(false);
    setSelectedFaculty(null);
    setEditForm(initialEditForm);
    setEditError('');
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    // NOTE: Does NOT clear createdCredentials banner so guidance persists!
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (updating || !selectedFaculty) return;

    const name = editForm.name.trim();
    const email = editForm.email.trim().toLowerCase();
    const designation = editForm.designation;
    const department = editForm.department;
    const password = editForm.password;
    const confirmPassword = editForm.confirmPassword;

    if (!name) {
      setEditError('Full name is required.');
      return;
    }

    if (!email) {
      setEditError('Email address is required.');
      return;
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      setEditError('Please provide a valid email address.');
      return;
    }

    if (password) {
      if (password.length < 6) {
        setEditError('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setEditError('New password and confirm password do not match.');
        return;
      }
    }

    const payload = {
      name,
      email,
      department: department || undefined,
      isActive: editForm.isActive,
    };

    if (password) {
      payload.password = password;
    }

    setUpdating(true);
    setEditError('');

    try {
      const { faculty } = await updateFacultyUser(selectedFaculty._id, payload);
      toast.success(`Account updated for ${faculty.name}.`);

      if (password) {
        setCreatedCredentials({
          name: faculty.name,
          email,
          password,
          designation: faculty.designation || designation,
          isReset: true,
        });
      }

      setEditModalOpen(false);
      setSelectedFaculty(null);
      await fetchFaculties();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update user account.';
      setEditError(msg);
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  // ── Copy Credentials to Clipboard ──
  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const credText = `CFES Portal Login Credentials\nName: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.password}\nPortal URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(credText).then(() => {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    });
  };

  return (
    <div className="users-page">
      {/* ── Page Header ── */}
      <div className="users-header">
        <div>
          <h1 className="users-heading">Faculty &amp; User Management</h1>
          <p className="users-sub">
            Manage institutional user accounts, role designations, and departmental affiliations.
          </p>
        </div>

        <div className="users-header-actions">
          <Button
            variant="primary"
            onClick={handleOpenCreateModal}
            id="btn-create-user-modal"
          >
            + Create User
          </Button>
        </div>
      </div>

      {/* ── Persistent Credential Notice Banner ── */}
      {createdCredentials && (
        <div className="users-credential-banner" role="alert">
          <div className="users-credential-header">
            <div className="users-credential-title-group">
              <span className="users-credential-icon">
                <Icon name="check" size={18} />
              </span>
              <h3 className="users-credential-title">
                {createdCredentials.isReset
                  ? 'Temporary Password Generated'
                  : 'Account Created Successfully'}
              </h3>
            </div>
            <button
              type="button"
              className="users-credential-dismiss"
              onClick={() => setCreatedCredentials(null)}
              aria-label="Dismiss credential notice"
              title="Dismiss"
            >
              ✕
            </button>
          </div>

          <div className="users-credential-content">
            <p className="users-credential-desc">
              Please securely communicate these credentials to the user. For institutional security,
              passwords are encrypted at rest and will not be displayed again once dismissed.
            </p>

            <div className="users-credential-grid">
              <div className="users-credential-field">
                <span className="users-credential-label">Name</span>
                <span className="users-credential-value">{createdCredentials.name}</span>
              </div>
              <div className="users-credential-field">
                <span className="users-credential-label">Email / Login ID</span>
                <span className="users-credential-value">
                  <code>{createdCredentials.email}</code>
                </span>
              </div>
              <div className="users-credential-field">
                <span className="users-credential-label">Temporary Password</span>
                <span className="users-credential-value users-credential-pass">
                  <code>{createdCredentials.password}</code>
                </span>
              </div>
            </div>

            <div className="users-credential-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyCredentials}
                id="btn-copy-credentials"
              >
                {copiedNotice ? '✓ Copied to Clipboard' : 'Copy Credentials'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatedCredentials(null)}
              >
                Dismiss Notice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters and Search Bar ── */}
      <div className="users-card users-filters-card">
        <div className="users-filters-grid">
          {/* Search Box */}
          <div className="users-filter-group users-search-group">
            <label className="users-filter-label" htmlFor="user-search">Search</label>
            <input
              id="user-search"
              type="text"
              className="users-filter-input"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Designation Filter */}
          <div className="users-filter-group">
            <label className="users-filter-label" htmlFor="filter-designation">Designation</label>
            <select
              id="filter-designation"
              className="users-filter-select"
              value={designationFilter}
              onChange={(e) => setDesignationFilter(e.target.value)}
            >
              <option value="ALL">All Designations</option>
              <option value="faculty">Faculty</option>
              <option value="hod">Head of Department (HoD)</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="users-filter-group">
            <label className="users-filter-label" htmlFor="filter-department">Department</label>
            <select
              id="filter-department"
              className="users-filter-select"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="users-filter-group">
            <label className="users-filter-label" htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              className="users-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & Reset Bar */}
        <div className="users-summary-bar">
          <span className="users-summary-count">
            Showing <strong>{filteredFaculties.length}</strong> of{' '}
            <strong>{faculties.length}</strong> user accounts
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              className="users-reset-btn"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Main Users Table ── */}
      <div className="users-card users-table-card">
        {loadingList ? (
          <div className="users-loading-state">
            <span className="users-spinner">
              <Icon name="spinner" size={24} />
            </span>
            <p>Loading user accounts...</p>
          </div>
        ) : listError ? (
          <div className="users-error-state">
            <p className="users-error-text">{listError}</p>
            <Button variant="secondary" size="sm" onClick={fetchFaculties}>
              Retry
            </Button>
          </div>
        ) : filteredFaculties.length === 0 ? (
          <div className="users-empty-state">
            <p className="users-empty-title">
              {hasActiveFilters
                ? 'No users match the selected filters.'
                : 'No faculty accounts found in the portal.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                Clear All Filters
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
                + Create First Account
              </Button>
            )}
          </div>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>User</th>
                  <th style={{ width: '24%' }}>Email</th>
                  <th style={{ width: '16%' }}>Designation</th>
                  <th style={{ width: '16%' }}>Department</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFaculties.map((faculty) => (
                  <tr key={faculty._id} className="users-table-row">
                    <td>
                      <div className="users-identity-cell">
                        <span className="users-name">{faculty.name}</span>
                        <span className="users-sub-email">{faculty.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="users-email-text">{faculty.email}</span>
                    </td>
                    <td>
                      <span className={`users-role-chip ${faculty.designation === 'hod' ? 'users-role-chip--hod' : ''}`}>
                        {faculty.designation === 'hod' ? 'Head of Dept' : 'Faculty'}
                      </span>
                    </td>
                    <td>
                      <span className="users-department-text">
                        {getDepartmentLabel(faculty)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        status={faculty.isActive ? 'active' : 'inactive'}
                        label={faculty.isActive ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => handleOpenEditModal(faculty)}
                        id={`btn-edit-user-${faculty._id}`}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create User Modal ── */}
      <Modal
        isOpen={createModalOpen}
        onClose={handleCloseCreateModal}
        title="Create New User Account"
        size="md"
        footer={
          <div className="users-modal-footer">
            <Button
              variant="ghost"
              onClick={handleCloseCreateModal}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateSubmit}
              isLoading={creating}
              id="btn-submit-create-user"
            >
              Create Account
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="users-dialog-form" noValidate>
          {createError && (
            <div className="users-form-alert users-form-alert--error" role="alert">
              {createError}
            </div>
          )}

          <div className="users-form-section">
            <h4 className="users-form-section-title">User Information</h4>
            <div className="users-form-row">
              <div className="users-field-group">
                <label className="users-field-label" htmlFor="create-name">
                  Full Name <span className="users-required">*</span>
                </label>
                <input
                  id="create-name"
                  name="name"
                  type="text"
                  className="users-field-input"
                  placeholder="e.g. Dr. Muhammad Tariq"
                  value={createForm.name}
                  onChange={handleCreateChange}
                  disabled={creating}
                  required
                />
              </div>

              <div className="users-field-group">
                <label className="users-field-label" htmlFor="create-email">
                  Institutional Email <span className="users-required">*</span>
                </label>
                <input
                  id="create-email"
                  name="email"
                  type="email"
                  className="users-field-input"
                  placeholder="tariq@iqra.edu.pk"
                  value={createForm.email}
                  onChange={handleCreateChange}
                  disabled={creating}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <div className="users-form-section">
            <h4 className="users-form-section-title">Role &amp; Department</h4>
            <div className="users-form-row">
              <div className="users-field-group">
                <label className="users-field-label" htmlFor="create-designation">
                  Designation <span className="users-required">*</span>
                </label>
                <select
                  id="create-designation"
                  name="designation"
                  className="users-field-select"
                  value={createForm.designation}
                  onChange={handleCreateChange}
                  disabled={creating}
                >
                  <option value="faculty">Faculty Member</option>
                  <option value="hod">Head of Department (HoD)</option>
                </select>
              </div>

              <div className="users-field-group">
                <label className="users-field-label" htmlFor="create-department">
                  Department {createForm.designation === 'hod' && <span className="users-required">*</span>}
                </label>
                <select
                  id="create-department"
                  name="department"
                  className="users-field-select"
                  value={createForm.department}
                  onChange={handleCreateChange}
                  disabled={creating}
                >
                  <option value="">{createForm.designation === 'hod' ? 'Select Department' : 'Unassigned (None)'}</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {createForm.designation === 'hod' && (
              <p className="users-field-hint">
                Note: Creating an HoD account with a department automatically assigns them as the official Head for that department.
              </p>
            )}
          </div>

          <div className="users-form-section">
            <h4 className="users-form-section-title">Initial Credentials</h4>
            <div className="users-form-row">
              <div className="users-field-group">
                <label className="users-field-label" htmlFor="create-password">
                  Temporary Password <span className="users-required">*</span>
                </label>
                <input
                  id="create-password"
                  name="password"
                  type="password"
                  className="users-field-input"
                  placeholder="Min. 6 characters"
                  value={createForm.password}
                  onChange={handleCreateChange}
                  disabled={creating}
                  autoComplete="new-password"
                />
              </div>

              <div className="users-field-group">
                <label className="users-field-label" htmlFor="create-confirm-password">
                  Confirm Password <span className="users-required">*</span>
                </label>
                <input
                  id="create-confirm-password"
                  name="confirmPassword"
                  type="password"
                  className="users-field-input"
                  placeholder="Retype password"
                  value={createForm.confirmPassword}
                  onChange={handleCreateChange}
                  disabled={creating}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="users-field-hint">
              The user can update their password after their initial login.
            </p>
          </div>
        </form>
      </Modal>

      {/* ── Edit User Modal ── */}
      <Modal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        title="Edit User Account"
        size="md"
        footer={
          <div className="users-modal-footer">
            <Button
              variant="ghost"
              onClick={handleCloseEditModal}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEditSubmit}
              isLoading={updating}
              id="btn-submit-edit-user"
            >
              Save Changes
            </Button>
          </div>
        }
      >
        {selectedFaculty && (
          <form onSubmit={handleEditSubmit} className="users-dialog-form" noValidate>
            {editError && (
              <div className="users-form-alert users-form-alert--error" role="alert">
                {editError}
              </div>
            )}

            {/* User Identity Context Card */}
            <div className="users-edit-context">
              <div className="users-edit-context-info">
                <span className="users-edit-context-name">{selectedFaculty.name}</span>
                <span className="users-edit-context-email">{selectedFaculty.email}</span>
              </div>
              <div className="users-edit-context-status">
                <StatusBadge
                  status={editForm.isActive ? 'active' : 'inactive'}
                  label={editForm.isActive ? 'Active' : 'Inactive'}
                />
              </div>
            </div>

            <div className="users-form-section">
              <h4 className="users-form-section-title">Profile Information</h4>
              <div className="users-form-row">
                <div className="users-field-group">
                  <label className="users-field-label" htmlFor="edit-name">
                    Full Name <span className="users-required">*</span>
                  </label>
                  <input
                    id="edit-name"
                    name="name"
                    type="text"
                    className="users-field-input"
                    value={editForm.name}
                    onChange={handleEditChange}
                    disabled={updating}
                    required
                  />
                </div>

                <div className="users-field-group">
                  <label className="users-field-label" htmlFor="edit-email">
                    Institutional Email <span className="users-required">*</span>
                  </label>
                  <input
                    id="edit-email"
                    name="email"
                    type="email"
                    className="users-field-input"
                    value={editForm.email}
                    onChange={handleEditChange}
                    disabled={updating}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div className="users-form-section">
              <h4 className="users-form-section-title">Department Affiliation</h4>
              <div className="users-form-group">
                <label className="users-field-label" htmlFor="edit-department">Department</label>
                <select
                  id="edit-department"
                  name="department"
                  className="users-field-select"
                  value={editForm.department}
                  onChange={handleEditChange}
                  disabled={updating}
                >
                  <option value="">Unassigned (None)</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="users-form-section">
              <h4 className="users-form-section-title">Password Reset (Optional)</h4>
              <p className="users-field-hint" style={{ marginBottom: '0.65rem' }}>
                Leave both password fields blank to retain the current password.
              </p>
              <div className="users-form-row">
                <div className="users-field-group">
                  <label className="users-field-label" htmlFor="edit-password">
                    New Password
                  </label>
                  <input
                    id="edit-password"
                    name="password"
                    type="password"
                    className="users-field-input"
                    placeholder="Leave blank to keep current"
                    value={editForm.password}
                    onChange={handleEditChange}
                    disabled={updating}
                    autoComplete="new-password"
                  />
                </div>

                <div className="users-field-group">
                  <label className="users-field-label" htmlFor="edit-confirm-password">
                    Confirm New Password
                  </label>
                  <input
                    id="edit-confirm-password"
                    name="confirmPassword"
                    type="password"
                    className="users-field-input"
                    placeholder="Retype new password"
                    value={editForm.confirmPassword}
                    onChange={handleEditChange}
                    disabled={updating}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div className="users-form-section">
              <h4 className="users-form-section-title">Account Status</h4>
              <label className="users-status-toggle">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={editForm.isActive}
                  onChange={handleEditChange}
                  disabled={updating}
                />
                <span className="users-status-toggle-label">
                  Account is Active (User can log in to portal)
                </span>
              </label>

              {!editForm.isActive && (
                <div className="users-deactivation-warning" role="alert">
                  <span className="users-deactivation-icon">
                    <Icon name="alert" size={16} />
                  </span>
                  <p>
                    <strong>Warning:</strong> Deactivating this account will prevent this user from
                    logging in. Existing course submissions and files remain preserved.
                  </p>
                </div>
              )}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Users;
