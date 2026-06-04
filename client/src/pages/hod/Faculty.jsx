import { useEffect, useState } from 'react';
import api from '../../api/axios';
import '../dean/Users.css'; // Reusing Users CSS

const HodFaculty = () => {
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFaculties = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/faculty');
      setFaculties(data.data.faculties || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load faculty.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculties();
  }, []);

  return (
    <div className="users-page">
      <h1 className="users-heading">Department Faculty</h1>
      <p className="users-sub">View all faculty members within your department.</p>

      {error && <div className="users-alert users-alert-error">{error}</div>}

      <div className="users-card users-card-section">
        <h2 className="users-card-title">Faculty List</h2>
        
        {loading ? (
          <p className="users-muted">Loading faculty...</p>
        ) : faculties.length === 0 ? (
          <p className="users-muted">No faculty found in your department.</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Designation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {faculties.map((faculty) => (
                  <tr key={faculty._id}>
                    <td><strong>{faculty.name}</strong></td>
                    <td>{faculty.email}</td>
                    <td>{faculty.designation}</td>
                    <td>
                      <span className={`courses-semester-badge ${faculty.isActive ? 'courses-semester-badge--active' : ''}`}>
                        {faculty.isActive ? 'Active' : 'Inactive'}
                      </span>
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

export default HodFaculty;
