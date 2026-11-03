import { useEffect, useState, useMemo, useCallback } from 'react';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import api from '../../api/axios';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import Icon from '../../components/common/Icon';
import './Faculty.css';

const HodFaculty = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [faculties, setFaculties] = useState([]);
  const [activeSemester, setActiveSemester] = useState(null);
  const [offeringsCountMap, setOfferingsCountMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Filter State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [designationFilter, setDesignationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [allocationFilter, setAllocationFilter] = useState('ALL');

  const userDept = user?.department;
  const userDeptId = userDept?._id || userDept;
  const deptName = userDept?.name || 'Department';

  // ── Fetch Master Faculty & Active Semester Offerings ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch department faculty (scoped automatically by requireDepartmentScope)
      const facultyPromise = api.get('/users/faculty');

      // 2. Fetch semesters to identify active semester
      const semesterPromise = api.get('/semesters').catch(() => ({ data: { data: { semesters: [] } } }));

      const [facultyRes, semesterRes] = await Promise.all([facultyPromise, semesterPromise]);

      const fetchedFaculties = facultyRes.data?.data?.faculties || [];
      const semesters = semesterRes.data?.data?.semesters || [];
      const activeSem = semesters.find((s) => s.status === 'active') || semesters[0] || null;
      setActiveSemester(activeSem);

      // 3. Compute assigned offering counts in active semester if available
      const countMap = {};
      if (activeSem?._id) {
        try {
          const offeringsRes = await api.get(`/offerings?semester=${activeSem._id}`);
          const offerings = offeringsRes.data?.data?.offerings || [];
          offerings.forEach((off) => {
            const facId = off.faculty?._id || off.faculty;
            if (facId) {
              const key = facId.toString();
              countMap[key] = (countMap[key] || 0) + 1;
            }
          });
        } catch (offErr) {
          console.warn('Could not load semester offerings for faculty count mapping:', offErr);
        }
      }

      setOfferingsCountMap(countMap);
      setFaculties(fetchedFaculties);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to load department faculty.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered Faculty List ──
  const filteredFaculties = useMemo(() => {
    return faculties.filter((faculty) => {
      // 1. Strict Department Safeguard: Ensure record matches HoD's assigned department
      if (userDeptId && faculty.department) {
        const facDeptId = faculty.department._id || faculty.department;
        if (facDeptId.toString() !== userDeptId.toString()) {
          return false;
        }
      }

      // 2. Designation Filter
      if (designationFilter !== 'ALL' && faculty.designation !== designationFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'ALL') {
        const isActive = Boolean(faculty.isActive);
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;
      }

      // 4. Teaching Allocation Filter
      if (allocationFilter !== 'ALL') {
        const count = offeringsCountMap[faculty._id] || 0;
        if (allocationFilter === 'allocated' && count === 0) return false;
        if (allocationFilter === 'unallocated' && count > 0) return false;
      }

      // 5. Search Query (Name or Email)
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
  }, [faculties, userDeptId, designationFilter, statusFilter, allocationFilter, searchQuery, offeringsCountMap]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    designationFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    allocationFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setDesignationFilter('ALL');
    setStatusFilter('ALL');
    setAllocationFilter('ALL');
  };

  return (
    <div className="hod-faculty-page">
      {/* ── Page Header ── */}
      <div className="hod-faculty-header">
        <div>
          <h1 className="hod-faculty-heading">Department Faculty</h1>
          <p className="hod-faculty-sub">
            Academic faculty directory and active teaching allocations for your department.
          </p>
        </div>

        <div className="hod-faculty-header-badges">
          {activeSemester && (
            <div className="hod-faculty-badge">
              <Icon name="book" size={14} />
              <span>{activeSemester.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content Card ── */}
      <div className="hod-faculty-card">
        {/* Controls Bar */}
        <div className="hod-faculty-controls">
          <div className="hod-faculty-filters-grid">
            {/* Search Input */}
            <div className="hod-faculty-filter-item">
              <label className="hod-faculty-filter-label" htmlFor="faculty-search">
                Search Faculty
              </label>
              <input
                id="faculty-search"
                type="text"
                className="hod-faculty-filter-input"
                placeholder="Search name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Designation Filter */}
            <div className="hod-faculty-filter-item">
              <label className="hod-faculty-filter-label" htmlFor="filter-designation">
                Designation
              </label>
              <select
                id="filter-designation"
                className="hod-faculty-filter-select"
                value={designationFilter}
                onChange={(e) => setDesignationFilter(e.target.value)}
                disabled={loading}
              >
                <option value="ALL">All Designations</option>
                <option value="faculty">Faculty</option>
                <option value="hod">Head of Department</option>
              </select>
            </div>

            {/* Account Status Filter */}
            <div className="hod-faculty-filter-item">
              <label className="hod-faculty-filter-label" htmlFor="filter-status">
                Account Status
              </label>
              <select
                id="filter-status"
                className="hod-faculty-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                disabled={loading}
              >
                <option value="ALL">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Allocation Filter */}
            <div className="hod-faculty-filter-item">
              <label className="hod-faculty-filter-label" htmlFor="filter-allocation">
                Teaching Allocation
              </label>
              <select
                id="filter-allocation"
                className="hod-faculty-filter-select"
                value={allocationFilter}
                onChange={(e) => setAllocationFilter(e.target.value)}
                disabled={loading}
              >
                <option value="ALL">All Faculty</option>
                <option value="allocated">Allocated Courses</option>
                <option value="unallocated">Unallocated</option>
              </select>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="hod-faculty-summary-bar">
            <span>
              Showing <strong>{filteredFaculties.length}</strong> of{' '}
              <strong>{faculties.length}</strong> department faculty members
              {activeSemester ? ` (${activeSemester.name})` : ''}
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                className="hod-faculty-reset-btn"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* ── Table & State Handling ── */}
        {loading ? (
          <div className="hod-faculty-loading-state">
            <span className="hod-faculty-spinner">
              <Icon name="spinner" size={24} />
            </span>
            <p className="hod-faculty-empty-title">Loading department faculty...</p>
          </div>
        ) : error ? (
          <div className="hod-faculty-error-state">
            <Icon name="alert" size={24} />
            <p className="hod-faculty-error-text">{error}</p>
            <Button variant="secondary" size="sm" onClick={fetchData}>
              Retry
            </Button>
          </div>
        ) : filteredFaculties.length === 0 ? (
          <div className="hod-faculty-empty-state">
            <p className="hod-faculty-empty-title">
              {hasActiveFilters
                ? 'No faculty members match your search or filter criteria.'
                : 'No faculty accounts found in this department.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                Clear All Filters
              </Button>
            ) : (
              <p className="hod-faculty-empty-sub">
                Faculty members assigned to {deptName} will appear here.
              </p>
            )}
          </div>
        ) : (
          <div className="hod-faculty-table-wrap">
            <table className="hod-faculty-table">
              <thead>
                <tr>
                  <th style={{ width: '38%' }}>Faculty Member</th>
                  <th style={{ width: '22%' }}>Designation</th>
                  <th style={{ width: '18%' }}>Account Status</th>
                  <th style={{ width: '22%' }}>
                    Active Offerings {activeSemester ? `(${activeSemester.name})` : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredFaculties.map((faculty) => {
                  const offeringCount = offeringsCountMap[faculty._id] || 0;
                  const isHod = faculty.designation === 'hod';

                  return (
                    <tr key={faculty._id}>
                      <td>
                        <div className="hod-faculty-cell-user">
                          <span className="hod-faculty-user-name">{faculty.name}</span>
                          <span className="hod-faculty-user-email">{faculty.email}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`hod-faculty-desig-badge ${
                            isHod
                              ? 'hod-faculty-desig-badge--hod'
                              : 'hod-faculty-desig-badge--faculty'
                          }`}
                        >
                          {isHod ? 'Head of Department' : 'Faculty'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge
                          status={faculty.isActive ? 'active' : 'inactive'}
                          label={faculty.isActive ? 'Active' : 'Inactive'}
                          size="sm"
                        />
                      </td>
                      <td>
                        <span
                          className={`hod-faculty-count-badge ${
                            offeringCount > 0
                              ? 'hod-faculty-count-badge--assigned'
                              : 'hod-faculty-count-badge--zero'
                          }`}
                        >
                          {offeringCount > 0
                            ? `${offeringCount} ${offeringCount === 1 ? 'Offering' : 'Offerings'}`
                            : 'Unallocated'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodFaculty;
