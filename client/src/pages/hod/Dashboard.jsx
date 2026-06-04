import useAuth from '../../hooks/useAuth';
import '../dean/Dashboard.css';

const HodDashboard = () => {
  const { user } = useAuth();
  return (
    <div className="dashboard">
      <h1 className="dashboard-heading">Department Dashboard</h1>
      <p className="dashboard-sub">Welcome back, {user?.name}. Here's an overview of your department.</p>
      
      <div className="stats-grid">
        <div className="stat-card stat-card--blue">
          <span className="stat-value">—</span>
          <span className="stat-label">Total Faculty</span>
        </div>
        <div className="stat-card stat-card--yellow">
          <span className="stat-value">—</span>
          <span className="stat-label">Active Courses</span>
        </div>
        <div className="stat-card stat-card--green">
          <span className="stat-value">—</span>
          <span className="stat-label">Submissions Approved</span>
        </div>
        <div className="stat-card stat-card--red">
          <span className="stat-value">—</span>
          <span className="stat-label">Pending Reviews</span>
        </div>
      </div>
    </div>
  );
};

export default HodDashboard;
