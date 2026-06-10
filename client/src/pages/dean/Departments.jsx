import { useEffect, useState } from 'react';
import api from '../../api/axios';
import useToast from '../../hooks/useToast';
import '../dean/Users.css'; // Reusing Users CSS for similar styling

const Departments = () => {
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);

  // Local state to track selected HoD per department before saving
  const [selectedHods, setSelectedHods] = useState({});
  const [savingId, setSavingId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [depRes, facRes] = await Promise.all([
        api.get('/departments'),
        api.get('/users/faculty')
      ]);
      const depts = depRes.data.data.departments || [];
      const facs = facRes.data.data.faculties || [];
      
      setDepartments(depts);
      setFaculties(facs);

      // Initialize selected HoDs state
      const initialHods = {};
      depts.forEach(d => {
        initialHods[d._id] = d.hod?._id || '';
      });
      setSelectedHods(initialHods);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleHodChange = (deptId, hodId) => {
    setSelectedHods(prev => ({ ...prev, [deptId]: hodId }));
  };

  const handleSaveHod = async (deptId) => {
    setSavingId(deptId);
    
    try {
      const hodId = selectedHods[deptId];
      await api.put(`/departments/${deptId}/hod`, { hodId: hodId || null });
      toast.success('Department HoD updated successfully.');
      await fetchData(); // Refresh data to get updated populated fields
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update HoD.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="users-page">
      <h1 className="users-heading">Department Management</h1>
      <p className="users-sub">View departments and assign Heads of Department (HoD).</p>

      <div className="users-card users-card-section">
        <h2 className="users-card-title">Departments Overview</h2>
        
        {loading ? (
          <p className="users-muted">Loading departments...</p>
        ) : departments.length === 0 ? (
          <p className="users-muted">No departments found.</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Department Name</th>
                  <th>Current HoD</th>
                  <th>Assign HoD</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept._id}>
                    <td><strong>{dept.code}</strong></td>
                    <td>{dept.name}</td>
                    <td>{dept.hod ? `${dept.hod.name}` : <span className="users-muted">None</span>}</td>
                    <td>
                      <select
                        className="users-input"
                        style={{ margin: 0, padding: '0.4rem', height: 'auto' }}
                        value={selectedHods[dept._id] || ''}
                        onChange={(e) => handleHodChange(dept._id, e.target.value)}
                        disabled={savingId === dept._id}
                      >
                        <option value="">-- No HoD --</option>
                        {faculties.map(fac => (
                          <option key={fac._id} value={fac._id}>
                            {fac.name} ({fac.designation})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="users-link-btn"
                        onClick={() => handleSaveHod(dept._id)}
                        disabled={savingId === dept._id || selectedHods[dept._id] === (dept.hod?._id || '')}
                      >
                        {savingId === dept._id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Departments;
