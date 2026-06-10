import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import { getHodDashboardStats } from '../../services/dashboard.service';
import '../dean/Dashboard.css';

const HodDashboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getHodDashboardStats();
        setStats(res.data);
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        toast.error(error.response?.data?.message || 'Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [toast]);

  if (loading) {
    return (
      <div className="dashboard">
        <h1 className="dashboard-heading">Department Dashboard</h1>
        <p className="dashboard-sub">Welcome back, {user?.name}. Here's an overview of your department.</p>
        <div className="stats-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="stat-card" style={{ opacity: 0.6 }}>
              <span className="stat-value" style={{ color: '#cbd5e1' }}>—</span>
              <span className="stat-label">Loading...</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Department Faculty', value: stats?.totalFaculty ?? 0, color: 'blue' },
    { label: 'Department Courses', value: stats?.totalCourses ?? 0, color: 'purple' },
    { label: 'Assigned Offerings', value: stats?.totalOfferings ?? 0, color: 'blue' },
    { label: 'Submitted Forms', value: stats?.totalSubmittedForms ?? 0, color: 'green' },
    { label: 'Draft Forms', value: stats?.totalDraftForms ?? 0, color: 'yellow' },
    { label: 'Pending Forms', value: stats?.pendingForms ?? 0, color: 'red' },
  ];

  return (
    <div className="dashboard">
      <h1 className="dashboard-heading">Department Dashboard</h1>
      <p className="dashboard-sub">Welcome back, {user?.name}. Here's an overview of your department.</p>
      
      {!stats ? (
        <div className="empty-state">
          <p>Unable to retrieve statistics at this time. Are you assigned to a department?</p>
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map((card, index) => (
            <div key={index} className={`stat-card stat-card--${card.color}`}>
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HodDashboard;
