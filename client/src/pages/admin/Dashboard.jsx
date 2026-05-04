import useAuth from '../../hooks/useAuth';
import './Dashboard.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  return (
    <div className="dashboard">
      <h1 className="dashboard-heading">Welcome, {user?.name} </h1>
      <p className="dashboard-sub">Here&apos;s what&apos;s happening today.</p>
      <div className="stats-grid">
        <div className="stat-card stat-card--blue">
          <span className="stat-value">—</span>
          <span className="stat-label">Total Submissions</span>
        </div>
        <div className="stat-card stat-card--yellow">
          <span className="stat-value">—</span>
          <span className="stat-label">Pending Review</span>
        </div>
        <div className="stat-card stat-card--green">
          <span className="stat-value">—</span>
          <span className="stat-label">Approved</span>
        </div>
        <div className="stat-card stat-card--red">
          <span className="stat-value">—</span>
          <span className="stat-label">Rejected</span>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
