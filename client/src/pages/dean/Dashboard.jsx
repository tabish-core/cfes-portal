import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import { getDeanDashboardStats } from '../../services/dashboard.service';
import './Dashboard.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getDeanDashboardStats();
        setStats(res.data);
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        toast.error('Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [toast]);

  // Loading skeleton layout
  if (loading) {
    return (
      <div className="dashboard">
        <h1 className="dashboard-heading">Welcome, {user?.name} </h1>
        <p className="dashboard-sub">Here&apos;s what&apos;s happening today.</p>
        <div className="stats-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="stat-card" style={{ opacity: 0.6 }}>
              <span className="stat-value" style={{ color: '#cbd5e1' }}>—</span>
              <span className="stat-label">Loading...</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Define stat cards configuration
  const statCards = [
    { label: 'Total Departments', value: stats?.totalDepartments ?? 0, color: 'blue' },
    { label: 'Total Faculty', value: stats?.totalFaculty ?? 0, color: 'purple' },
    { label: 'Total HoDs', value: stats?.totalHods ?? 0, color: 'yellow' },
    { label: 'Total Courses', value: stats?.totalCourses ?? 0, color: 'green' },
    { label: 'Course Offerings', value: stats?.totalOfferings ?? 0, color: 'red' },
    { label: 'Submitted Forms', value: stats?.totalSubmittedForms ?? 0, color: 'green' },
    { label: 'Draft Forms', value: stats?.totalDraftForms ?? 0, color: 'yellow' },
    { label: 'Active Semester', value: stats?.activeSemester ?? 'None', color: 'blue' },
  ];

  return (
    <div className="dashboard">
      <h1 className="dashboard-heading">Welcome, {user?.name} </h1>
      <p className="dashboard-sub">Here&apos;s an overview of the system statistics.</p>
      
      {!stats ? (
        <div className="empty-state">
          <p>Unable to retrieve statistics at this time.</p>
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map((card, index) => (
            <div key={index} className={`stat-card stat-card--${card.color}`}>
              {/* For text-based stats like "Active Semester", we can adjust the font size slightly if needed, but it should inherit `.stat-value` nicely */}
              <span className="stat-value" style={typeof card.value === 'string' && card.value.length > 5 ? { fontSize: '1.5rem' } : {}}>
                {card.value}
              </span>
              <span className="stat-label">{card.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
