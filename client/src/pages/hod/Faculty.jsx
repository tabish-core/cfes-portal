import { Fragment, useEffect, useState, useMemo, useCallback } from 'react';
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
  const [departments, setDepartments] = useState([]);
  const [visibleDepartmentIds, setVisibleDepartmentIds] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState('ALL'); // 'ALL' | 'OWN' | deptId
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
  const isHoD = user?.designation === 'hod';

  // ── Fetch Master Faculty & Active Semester Offerings ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch department faculty.
      //    For HoDs, opt-in to cross-department visibility via ?visible=true.
      //    The backend enforces the visibility matrix server-side; the response
      //    also returns visibleDepartmentIds for client-side filtering.
      const facultyPromise = isHoD
        ? api.get('/users/faculty?visible=true')
        : api.get('/users/faculty');

      // 2. Fetch semesters to identify active semester
      const semesterPromise = api.get('/semesters').catch(() => ({ data: { data: { semesters: [] } } }));

      const [facultyRes, semesterRes] = await Promise.all([facultyPromise, semesterPromise]);

      const fetchedFaculties = facultyRes.data?.data?.faculties || [];
      const fetchedVisibleIds = facultyRes.data?.data?.visibleDepartmentIds || null;
      const fetchedDepartments = facultyRes.data?.data?.departments || [];
      const semesters = semesterRes.data?.data?.semesters || [];
      const activeSem = semesters.find((s) => s.status === 'active') || semesters[0] || null;
      setActiveSemester(activeSem);
      setVisibleDepartmentIds(fetchedVisibleIds);
      setDepartments(fetchedDepartments);

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
  }, [toast, isHoD]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered Faculty List ──
  const filteredFaculties = useMemo(() => {
    return faculties.filter((faculty) => {
      // Resolve the faculty's department id once (handles populated object or raw id).
      const facDept = faculty.department;
      const facDeptId = facDept ? (facDept._id || facDept) : null;
      const facDeptIdStr = facDeptId ? facDeptId.toString() : null;

      // 1. Department Safeguard:
      //    - Dean: no restriction (visibleDepartmentIds is null).
      //    - HoD with visibleDepartmentIds: allow faculty in the visible set.
      //    - HoD without visible set (fallback): own department only.
      //    - Faculty: own department only.
      if (userDeptId && facDeptIdStr) {
        const isOwnDepartment = facDeptIdStr === userDeptId.toString();
        const isVisible = Array.isArray(visibleDepartmentIds)
          ? visibleDepartmentIds.includes(facDeptIdStr)
          : false;

        if (!isOwnDepartment && !isVisible) {
          return false;
        }
      }

      // 6. Department filter (tabs)
      if (departmentFilter === 'OWN') {
        if (!facDeptIdStr || facDeptIdStr !== userDeptId.toString()) return false;
      } else if (departmentFilter !== 'ALL') {
        if (!facDeptIdStr || facDeptIdStr !== departmentFilter) return false;
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
  }, [faculties, userDeptId, visibleDepartmentIds, departmentFilter, designationFilter, statusFilter, allocationFilter, searchQuery, offeringsCountMap]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    designationFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    allocationFilter !== 'ALL' ||
    departmentFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setDesignationFilter('ALL');
    setStatusFilter('ALL');
    setAllocationFilter('ALL');
    setDepartmentFilter('ALL');
  };

  // Build the department filter tabs from the backend-supplied visible
  // departments (never hardcoded, never outside the visibility matrix).
  const departmentTabs = useMemo(() => {
    const tabs = [{ id: 'ALL', label: 'All Visible Departments' }];
    const ownId = userDeptId ? userDeptId.toString() : null;
    const ownDept = departments.find((d) => d._id?.toString() === ownId);
    const ownName = ownDept?.name || (userDept?.name || 'Department');

    tabs.push({
      id: 'OWN',
      label: `My Department${ownName ? ` (${ownName})` : ''}`,
    });

    departments.forEach((dept) => {
      const id = dept._id?.toString();
      if (!id || id === ownId) return;
      tabs.push({ id, label: dept.name });
    });

    return tabs;
  }, [departments, userDeptId, userDept?.name]);

  // Group faculties by department when "All Visible Departments" is selected.
  const groupedFaculties = useMemo(() => {
    if (departmentFilter !== 'ALL') return null;

    const map = new Map();
    departments.forEach((dept) => {
      const id = dept._id?.toString();
      if (id) map.set(id, { _id: dept._id, name: dept.name, code: dept.code, faculties: [] });
    });

    // Ensure the HoD's own department always appears as a group.
    const ownId = userDeptId ? userDeptId.toString() : null;
    if (ownId && !map.has(ownId)) {
      map.set(ownId, {
        _id: ownId,
        name: (departments.find((d) => d._id?.toString() === ownId)?.name) || (userDept?.name || 'Department'),
        code: '',
        faculties: [],
      });
    }

    filteredFaculties.forEach((faculty) => {
      const facDept = faculty.department;
      const facDeptId = facDept ? (facDept._id || facDept) : null;
      const key = facDeptId ? facDeptId.toString() : null;
      if (key && map.has(key)) {
        map.get(key).faculties.push(faculty);
      } else if (key && !map.has(key)) {
        // Faculty whose department is visible but not in the master list.
        map.set(key, {
          _id: key,
          name: (facDept && facDept.name) || 'Department',
          code: '',
          faculties: [faculty],
        });
      }
    });

    return Array.from(map.values());
  }, [departmentFilter, departments, userDeptId, userDept?.name, filteredFaculties]);

  // Whether a given faculty row is outside the HoD's own department
  const isCrossDepartmentRow = (faculty) => {
    if (!isHoD || !userDeptId || !faculty.department) return false;
    const facDeptId = (faculty.department._id || faculty.department).toString();
    return facDeptId !== userDeptId.toString();
  };

  // Render a single faculty row, showing its department name and ownership.
  const renderFacultyRow = (faculty) => {
    const offeringCount = offeringsCountMap[faculty._id] || 0;
    const isHod = faculty.designation === 'hod';
    const crossDept = isCrossDepartmentRow(faculty);

    const facDept = faculty.department;
    const facDeptId = facDept ? (facDept._id || facDept) : null;
    const facDeptIdStr = facDeptId ? facDeptId.toString() : null;
    const deptName = (facDept && facDept.name) || '—';
    const deptCode = facDept && facDept.code ? `(${facDept.code})` : '';
    const isOwnDept = facDeptIdStr ? facDeptIdStr === userDeptId.toString() : false;

    return (
      <tr key={faculty._id} className={crossDept ? 'hod-faculty-row--cross-dept' : ''}>
        <td>
          <div className="hod-faculty-cell-user">
            <span className="hod-faculty-user-name">{faculty.name}</span>
            <span className="hod-faculty-user-email">{faculty.email}</span>
            {crossDept && (
              <span className="hod-faculty-cross-dept-tag">
                View only — outside your department
              </span>
            )}
          </div>
        </td>
        <td>
          <span className="hod-faculty-row-dept">
            {deptName} {deptCode}
            {isOwnDept && <span className="hod-faculty-row-dept-own">Your department</span>}
          </span>
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

          {/* Department Filter Tabs */}
          <div className="hod-faculty-department-tabs">
            <label className="hod-faculty-department-tabs-label">View by Department</label>
            <div className="hod-faculty-department-tabs-list">
              {departmentTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`hod-faculty-dept-tab${departmentFilter === tab.id ? ' hod-faculty-dept-tab--active' : ''}`}
                  onClick={() => setDepartmentFilter(tab.id)}
                  disabled={loading}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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
                  <th style={{ width: '30%' }}>Faculty Member</th>
                  <th style={{ width: '18%' }}>Department</th>
                  <th style={{ width: '20%' }}>Designation</th>
                  <th style={{ width: '16%' }}>Account Status</th>
                  <th style={{ width: '16%' }}>
                    Active Offerings {activeSemester ? `(${activeSemester.name})` : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {departmentFilter === 'ALL' && groupedFaculties ? (
                  groupedFaculties.map((group) => (
                    <Fragment key={group._id}>
                      <tr>
                        <td colSpan={5} className="hod-faculty-dept-group-heading">
                          <span className="hod-faculty-dept-group-name">
                            {group.name}{group.code ? ` (${group.code})` : ''}
                          </span>
                          {group._id?.toString() === userDeptId?.toString() && (
                            <span className="hod-faculty-dept-group-own">— Your department</span>
                          )}
                          <span className="hod-faculty-dept-group-count">
                            ({group.faculties.length} faculty member{group.faculties.length !== 1 ? 's' : ''})
                          </span>
                        </td>
                      </tr>
                      {group.faculties.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="hod-faculty-dept-empty">
                            No faculty members in this department.
                          </td>
                        </tr>
                      ) : (
                        group.faculties.map((faculty) => renderFacultyRow(faculty))
                      )}
                    </Fragment>
                  ))
                ) : (
                  filteredFaculties.map((faculty) => renderFacultyRow(faculty))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodFaculty;
