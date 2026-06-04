import { useEffect, useState } from 'react';
import { getFaculties, registerFaculty, updateFacultyUser } from '../../services/auth.service';
import api from '../../api/axios';
import './Users.css';

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  designation: 'faculty',
  department: '',
};

// Users page — Admin creates faculty accounts.
const Users = () => {
  const [form, setForm] = useState(initialForm);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    designation: 'faculty',
    department: '',
    password: '',
    confirmPassword: '',
    isActive: true,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchFaculties = async () => {
    setLoadingList(true);
    try {
      const { faculties } = await getFaculties();
      setFaculties(faculties);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load faculty accounts.');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      setDepartments(data.data.departments || []);
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  useEffect(() => {
    fetchFaculties();
    fetchDepartments();
  }, []);

  useEffect(() => {
    const selected = faculties.find((f) => f._id === selectedFacultyId);
    if (!selected) return;
    setEditForm({
      name: selected.name || '',
      email: selected.email || '',
      designation: selected.designation || 'faculty',
      department: selected.department?._id || selected.department || '',
      password: '',
      confirmPassword: '',
      isActive: !!selected.isActive,
    });
  }, [selectedFacultyId, faculties]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setError('');
    setSuccess('');
    setCreatedCredentials(null);
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    const confirmPassword = form.confirmPassword;
    const designation = form.designation;
    const department = form.department;

    if (!name || !email || !password) {
      setError('Name, email, and password are required.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password and confirm password do not match.');
      return;
    }

    setLoading(true);
    try {
      const { user } = await registerFaculty({
        name,
        email,
        password,
        designation,
        department: department || undefined,
      });
      setSuccess(`Faculty account created for ${user.name} (${user.email}).`);
      setCreatedCredentials({ email, password });
      setForm(initialForm);
      await fetchFaculties();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create faculty account.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setError('');
    setSuccess('');
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      setError('Select a faculty account first.');
      return;
    }

    const name = editForm.name.trim();
    const email = editForm.email.trim().toLowerCase();
    const designation = editForm.designation;
    const department = editForm.department;
    const password = editForm.password;
    const confirmPassword = editForm.confirmPassword;

    if (!name || !email) {
      setError('Name and email are required.');
      return;
    }

    if (password && password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (password && password !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    const payload = {
      name,
      email,
      designation,
      department: department || undefined,
      isActive: editForm.isActive,
    };

    if (password) payload.password = password;

    setUpdating(true);
    try {
      const { faculty } = await updateFacultyUser(selectedFacultyId, payload);
      setSuccess(`Faculty account updated for ${faculty.name}.`);
      setCreatedCredentials(password ? { email, password } : null);
      await fetchFaculties();
      setEditForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update faculty account.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="users-page">
      <h1 className="users-heading">Faculty Management</h1>
      <p className="users-sub">Create, view, and update faculty credentials from this panel.</p>

      <div className="users-card">
        <h2 className="users-card-title">Create Faculty Account</h2>
        <form onSubmit={handleSubmit} className="users-form" noValidate autoComplete="off">
          <label className="users-label" htmlFor="faculty-name">Full name</label>
          <input
            id="faculty-name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            className="users-input"
            placeholder="Faculty Name"
            disabled={loading}
          />

          <label className="users-label" htmlFor="faculty-email">Email</label>
          <input
            id="faculty-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="users-input"
            placeholder="aisha@iqra.edu.pk"
            disabled={loading}
            autoComplete="new-password" // Using new-password on email sometimes helps trick aggressive password managers
          />

          <label className="users-label" htmlFor="faculty-password">Temporary password</label>
          <input
            id="faculty-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            className="users-input"
            placeholder="At least 6 characters"
            disabled={loading}
            autoComplete="new-password"
          />

          <label className="users-label" htmlFor="faculty-confirm-password">Confirm temporary password</label>
          <input
            id="faculty-confirm-password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="users-input"
            placeholder="Retype password"
            disabled={loading}
            autoComplete="new-password"
          />

          <label className="users-label" htmlFor="faculty-designation">Designation</label>
          <select
            id="faculty-designation"
            name="designation"
            value={form.designation}
            onChange={handleChange}
            className="users-input"
            disabled={loading}
          >
            <option value="faculty">Faculty</option>
            <option value="hod">Head of Department (HoD)</option>
          </select>

          <label className="users-label" htmlFor="faculty-department">Department (optional)</label>
          <select
            id="faculty-department"
            name="department"
            value={form.department}
            onChange={handleChange}
            className="users-input"
            disabled={loading}
          >
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
            ))}
          </select>

          {error && <div className="users-alert users-alert-error">{error}</div>}
          {success && <div className="users-alert users-alert-success">{success}</div>}
          {createdCredentials && (
            <div className="users-hint">
              Share these exact credentials:
              {' '}
              <strong>{createdCredentials.email}</strong>
              {' / '}
              <strong>{createdCredentials.password}</strong>
            </div>
          )}

          <button type="submit" className="users-submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Faculty'}
          </button>
        </form>
      </div>

      <div className="users-card users-card-section">
        <h2 className="users-card-title">Registered Faculties</h2>
        {loadingList ? (
          <p className="users-muted">Loading faculty accounts...</p>
        ) : faculties.length === 0 ? (
          <p className="users-muted">No faculty accounts found.</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Designation</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {faculties.map((faculty) => (
                  <tr key={faculty._id}>
                    <td>{faculty.name}</td>
                    <td>{faculty.email}</td>
                    <td>{faculty.designation}</td>
                    <td>{
                      departments.find(d => d._id === faculty.department)?.name ||
                      (faculty.department && faculty.department.name) ||
                      faculty.department || '—'
                    }</td>
                    <td>{faculty.isActive ? 'Active' : 'Inactive'}</td>
                    <td>
                      <button
                        type="button"
                        className="users-link-btn"
                        onClick={() => setSelectedFacultyId(faculty._id)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="users-card users-card-section">
        <h2 className="users-card-title">Update Faculty Credentials</h2>
        <form onSubmit={handleUpdate} className="users-form" noValidate autoComplete="off">
          <label className="users-label" htmlFor="faculty-select">Select faculty</label>
          <select
            id="faculty-select"
            name="facultySelect"
            className="users-input"
            value={selectedFacultyId}
            onChange={(e) => setSelectedFacultyId(e.target.value)}
            disabled={updating || loadingList}
          >
            <option value="">Choose a faculty account</option>
            {faculties.map((faculty) => (
              <option key={faculty._id} value={faculty._id}>
                {faculty.name} ({faculty.email})
              </option>
            ))}
          </select>

          <label className="users-label" htmlFor="edit-name">Full name</label>
          <input
            id="edit-name"
            name="name"
            type="text"
            value={editForm.name}
            onChange={handleEditChange}
            className="users-input"
            disabled={updating || !selectedFacultyId}
          />

          <label className="users-label" htmlFor="edit-email">Email</label>
          <input
            id="edit-email"
            name="email"
            type="email"
            value={editForm.email}
            onChange={handleEditChange}
            className="users-input"
            disabled={updating || !selectedFacultyId}
          />

          <label className="users-label" htmlFor="edit-designation">Designation</label>
          <select
            id="edit-designation"
            name="designation"
            value={editForm.designation}
            onChange={handleEditChange}
            className="users-input"
            disabled={updating || !selectedFacultyId}
          >
            <option value="faculty">Faculty</option>
            <option value="hod">Head of Department (HoD)</option>
          </select>

          <label className="users-label" htmlFor="edit-department">Department</label>
          <select
            id="edit-department"
            name="department"
            value={editForm.department}
            onChange={handleEditChange}
            className="users-input"
            disabled={updating || !selectedFacultyId}
          >
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
            ))}
          </select>

          <label className="users-label" htmlFor="edit-password">New password (optional)</label>
          <input
            id="edit-password"
            name="password"
            type="password"
            value={editForm.password}
            onChange={handleEditChange}
            className="users-input"
            placeholder="Leave blank to keep current password"
            disabled={updating || !selectedFacultyId}
            autoComplete="new-password"
          />

          <label className="users-label" htmlFor="edit-confirm-password">Confirm new password</label>
          <input
            id="edit-confirm-password"
            name="confirmPassword"
            type="password"
            value={editForm.confirmPassword}
            onChange={handleEditChange}
            className="users-input"
            placeholder="Retype new password"
            disabled={updating || !selectedFacultyId}
            autoComplete="new-password"
          />

          <label className="users-checkbox">
            <input
              type="checkbox"
              name="isActive"
              checked={editForm.isActive}
              onChange={handleEditChange}
              disabled={updating || !selectedFacultyId}
            />
            Account active
          </label>

          <button type="submit" className="users-submit" disabled={updating || !selectedFacultyId}>
            {updating ? 'Updating...' : 'Update Faculty'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Users;
