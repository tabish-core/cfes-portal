import { useEffect, useState, useMemo, useCallback } from 'react';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import { getFaculties } from '../../services/auth.service';
import { getCourses } from '../../services/course.service';
import { getSemesters, createSemester, toggleSemesterStatus } from '../../services/semester.service';
import { createOffering, removeOffering, getOfferingsBySemester } from '../../services/courseOffering.service';
import api from '../../api/axios';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import Icon from '../../components/common/Icon';
import './Courses.css';

const Courses = () => {
  const { user } = useAuth();
  const toast = useToast();

  const isHod = user?.designation === 'hod';
  const userDeptId = user?.department?._id || user?.department;

  // ── Master Data State ──
  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [offerings, setOfferings] = useState([]);

  // ── Loading & Error States ──
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [offeringsError, setOfferingsError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [creatingSemester, setCreatingSemester] = useState(false);
  const [togglingSemesterId, setTogglingSemesterId] = useState(null);
  const [removingOffering, setRemovingOffering] = useState(false);

  // ── Semester Management State ──
  const [newSemesterName, setNewSemesterName] = useState('');
  const [semesterModalOpen, setSemesterModalOpen] = useState(false);

  // ── Assignment Form State ──
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [section, setSection] = useState('A');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [facultySearchTerm, setFacultySearchTerm] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // ── Offerings Table Filter & Search State ──
  const [viewSemesterId, setViewSemesterId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(isHod && userDeptId ? userDeptId : '');

  // ── Remove Offering Confirmation Modal State ──
  const [offeringToRemove, setOfferingToRemove] = useState(null);

  // ── 1. Fetch Master Data ──
  const fetchMasterData = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const [facultyRes, courseRes, semesterRes, deptRes] = await Promise.all([
        getFaculties(),
        getCourses(),
        getSemesters(),
        api.get('/departments').catch(() => ({ data: { data: { departments: [] } } })),
      ]);

      setFaculties(facultyRes.faculties || []);
      setCourses(courseRes.courses || []);
      const loadedSemesters = semesterRes.semesters || [];
      setSemesters(loadedSemesters);
      setDepartments(deptRes.data?.data?.departments || []);

      // Auto-select the active semester for both assignment form and view selector
      const active = loadedSemesters.find((s) => s.status === 'active');
      const fallback = active ? active._id : (loadedSemesters[0]?._id || '');
      setSelectedSemesterId(fallback);
      setViewSemesterId(fallback);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load initial allocation data.');
    } finally {
      setLoadingInitial(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  // Sync HoD department constraint
  useEffect(() => {
    if (isHod && userDeptId) {
      setSelectedDepartmentId(userDeptId);
    }
  }, [isHod, userDeptId]);

  // ── 2. Fetch Offerings for Selected View Semester ──
  const fetchOfferings = useCallback(async (semId) => {
    if (!semId) {
      setOfferings([]);
      return;
    }
    setLoadingOfferings(true);
    setOfferingsError('');
    try {
      const { offerings: fetchedOfferings } = await getOfferingsBySemester(semId);
      setOfferings(fetchedOfferings || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load offerings for this semester.';
      setOfferingsError(msg);
      toast.error(msg);
    } finally {
      setLoadingOfferings(false);
    }
  }, [toast]);

  useEffect(() => {
    if (viewSemesterId) {
      fetchOfferings(viewSemesterId);
    }
  }, [viewSemesterId, fetchOfferings]);

  // ── 3. Semester Management Actions ──
  const handleCreateSemester = async (e) => {
    e.preventDefault();
    const name = newSemesterName.trim();
    if (!name) {
      toast.warning('Please enter a semester name.');
      return;
    }

    setCreatingSemester(true);
    try {
      const { semester } = await createSemester(name);
      setSemesters((prev) => [semester, ...prev]);
      setNewSemesterName('');
      setSemesterModalOpen(false);
      toast.success(`Semester "${semester.name}" created successfully.`);

      // If no semester was selected, select the new one
      if (!viewSemesterId) {
        setViewSemesterId(semester._id);
        setSelectedSemesterId(semester._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create semester.');
    } finally {
      setCreatingSemester(false);
    }
  };

  const handleToggleSemester = async (semesterId) => {
    setTogglingSemesterId(semesterId);
    try {
      const { semester } = await toggleSemesterStatus(semesterId);
      const { semesters: updatedSemesters } = await getSemesters();
      setSemesters(updatedSemesters || []);
      toast.success(`Semester "${semester.name}" is now ${semester.status}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle semester status.');
    } finally {
      setTogglingSemesterId(null);
    }
  };

  // ── 4. Course Assignment Handlers ──
  const filteredCourseOptions = useMemo(() => {
    if (!courseSearchTerm.trim()) return courses;
    const q = courseSearchTerm.toLowerCase().trim();
    return courses.filter((c) => {
      const code = (c.courseCode || '').toLowerCase();
      const name = (c.courseName || '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [courses, courseSearchTerm]);

  const filteredFacultyOptions = useMemo(() => {
    if (!facultySearchTerm.trim()) return faculties;
    const q = facultySearchTerm.toLowerCase().trim();
    return faculties.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const email = (f.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [faculties, facultySearchTerm]);

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!selectedSemesterId) errors.semester = 'Please select a semester.';
    if (!selectedCourseId) errors.course = 'Please select a course.';
    if (!selectedFacultyId) errors.faculty = 'Please select a faculty member.';
    if (!section || !section.trim()) errors.section = 'Section is required.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.warning('Please resolve highlighted form validation errors.');
      return;
    }

    setFormErrors({});
    setAssigning(true);

    try {
      const cleanSection = (section || 'A').toUpperCase().trim();
      const { offering } = await createOffering(
        selectedFacultyId,
        selectedCourseId,
        selectedSemesterId,
        cleanSection
      );

      toast.success(
        `Assigned ${offering.course?.courseCode} (Section ${offering.section}) to ${offering.faculty?.name} in ${offering.semester?.name}.`
      );

      // Refresh table if the offering belongs to currently viewed semester
      if (viewSemesterId === selectedSemesterId) {
        await fetchOfferings(viewSemesterId);
      } else {
        // Switch to the newly assigned semester so the administrator can immediately see it
        setViewSemesterId(selectedSemesterId);
      }

      // Reset form selections
      setSelectedCourseId('');
      setSelectedFacultyId('');
      setSection('A');
      setCourseSearchTerm('');
      setFacultySearchTerm('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign course offering.');
    } finally {
      setAssigning(false);
    }
  };

  // ── 5. Destructive Unassign Handlers ──
  const handleOpenRemoveModal = (offering) => {
    setOfferingToRemove(offering);
  };

  const handleCloseRemoveModal = () => {
    if (removingOffering) return;
    setOfferingToRemove(null);
  };

  const handleConfirmRemove = async () => {
    if (!offeringToRemove) return;

    setRemovingOffering(true);
    try {
      await removeOffering(offeringToRemove._id);
      setOfferings((prev) => prev.filter((o) => o._id !== offeringToRemove._id));
      toast.success(
        `Course offering for ${offeringToRemove.course?.courseCode} (Section ${offeringToRemove.section}) removed successfully.`
      );
      setOfferingToRemove(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove course offering.');
    } finally {
      setRemovingOffering(false);
    }
  };

  // ── 6. Filter Offerings in View ──
  const filteredOfferings = useMemo(() => {
    return offerings.filter((offering) => {
      // 1. Department filter
      if (selectedDepartmentId) {
        const courseDept =
          offering.course?.department?._id ||
          offering.course?.department ||
          offering.faculty?.department?._id ||
          offering.faculty?.department;
        if (!courseDept || courseDept.toString() !== selectedDepartmentId.toString()) {
          return false;
        }
      }

      // 2. Search query (courseCode, courseName, faculty name, section)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (offering.course?.courseCode || '').toLowerCase();
        const name = (offering.course?.courseName || '').toLowerCase();
        const facultyName = (offering.faculty?.name || '').toLowerCase();
        const sec = (offering.section || '').toLowerCase();
        const secFull = `section ${sec}`;

        const matches =
          code.includes(q) ||
          name.includes(q) ||
          facultyName.includes(q) ||
          sec.includes(q) ||
          secFull.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [offerings, selectedDepartmentId, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    (!isHod && selectedDepartmentId !== '');

  const handleResetFilters = () => {
    setSearchQuery('');
    if (!isHod) setSelectedDepartmentId('');
  };

  const activeSemester = semesters.find((s) => s.status === 'active');
  const selectedViewSemester = semesters.find((s) => s._id === viewSemesterId);

  return (
    <div className="courses-page">
      {/* ── Page Header ── */}
      <div className="courses-header">
        <div>
          <h1 className="courses-heading">Course Allocation &amp; Offerings</h1>
          <p className="courses-sub">
            Manage academic semester cycles and allocate faculty members to course sections.
          </p>
        </div>

        <div className="courses-header-actions">
          {activeSemester && (
            <div className="courses-active-badge">
              <span className="courses-active-dot" />
              <span>Active Semester: <strong>{activeSemester.name}</strong></span>
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => setSemesterModalOpen(true)}
            id="btn-manage-semesters"
          >
            Manage Semesters
          </Button>
        </div>
      </div>

      {/* ── Course Allocation / Assignment Card ── */}
      <div className="courses-card">
        <div className="courses-card-header">
          <div>
            <h2 className="courses-card-title">Assign Course Offering</h2>
            <p className="courses-card-sub">
              Link a faculty instructor to a course catalog entry for a specific semester and section.
            </p>
          </div>
        </div>

        <form onSubmit={handleAssignSubmit} className="courses-assign-form" noValidate>
          <div className="courses-assign-grid">
            {/* Semester Selection */}
            <div className="courses-field-group">
              <label className="courses-field-label" htmlFor="assign-semester">
                Semester <span className="courses-required">*</span>
              </label>
              <select
                id="assign-semester"
                className={`courses-field-select ${formErrors.semester ? 'courses-field-select--error' : ''}`}
                value={selectedSemesterId}
                onChange={(e) => {
                  setSelectedSemesterId(e.target.value);
                  setFormErrors((prev) => ({ ...prev, semester: undefined }));
                }}
                disabled={loadingInitial || assigning}
              >
                <option value="">-- Choose Semester --</option>
                {semesters.map((sem) => (
                  <option key={sem._id} value={sem._id}>
                    {sem.name} {sem.status === 'active' ? '(Active)' : ''}
                  </option>
                ))}
              </select>
              {formErrors.semester && (
                <span className="courses-error-hint">{formErrors.semester}</span>
              )}
            </div>

            {/* Course Selection (Searchable) */}
            <div className="courses-field-group">
              <label className="courses-field-label" htmlFor="assign-course">
                Course <span className="courses-required">*</span>
              </label>
              <div className="courses-searchable-wrap">
                <input
                  type="text"
                  className="courses-filter-subinput"
                  placeholder="Filter courses by code/title..."
                  value={courseSearchTerm}
                  onChange={(e) => setCourseSearchTerm(e.target.value)}
                  disabled={loadingInitial || assigning}
                />
                <select
                  id="assign-course"
                  className={`courses-field-select ${formErrors.course ? 'courses-field-select--error' : ''}`}
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    setFormErrors((prev) => ({ ...prev, course: undefined }));
                  }}
                  disabled={loadingInitial || assigning}
                >
                  <option value="">-- Choose Course ({filteredCourseOptions.length} available) --</option>
                  {filteredCourseOptions.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.courseCode} — {course.courseName} ({course.type || 'Core'})
                    </option>
                  ))}
                </select>
              </div>
              {formErrors.course && (
                <span className="courses-error-hint">{formErrors.course}</span>
              )}
            </div>

            {/* Faculty Selection (Searchable) */}
            <div className="courses-field-group">
              <label className="courses-field-label" htmlFor="assign-faculty">
                Faculty Instructor <span className="courses-required">*</span>
              </label>
              <div className="courses-searchable-wrap">
                <input
                  type="text"
                  className="courses-filter-subinput"
                  placeholder="Filter faculty by name/email..."
                  value={facultySearchTerm}
                  onChange={(e) => setFacultySearchTerm(e.target.value)}
                  disabled={loadingInitial || assigning}
                />
                <select
                  id="assign-faculty"
                  className={`courses-field-select ${formErrors.faculty ? 'courses-field-select--error' : ''}`}
                  value={selectedFacultyId}
                  onChange={(e) => {
                    setSelectedFacultyId(e.target.value);
                    setFormErrors((prev) => ({ ...prev, faculty: undefined }));
                  }}
                  disabled={loadingInitial || assigning}
                >
                  <option value="">-- Choose Faculty ({filteredFacultyOptions.length} available) --</option>
                  {filteredFacultyOptions.map((fac) => (
                    <option key={fac._id} value={fac._id}>
                      {fac.name} ({fac.email})
                    </option>
                  ))}
                </select>
              </div>
              {formErrors.faculty && (
                <span className="courses-error-hint">{formErrors.faculty}</span>
              )}
            </div>

            {/* Section Selection */}
            <div className="courses-field-group courses-field-group--section">
              <label className="courses-field-label" htmlFor="assign-section">
                Section <span className="courses-required">*</span>
              </label>
              <input
                id="assign-section"
                type="text"
                className={`courses-field-input ${formErrors.section ? 'courses-field-input--error' : ''}`}
                value={section}
                onChange={(e) => {
                  setSection(e.target.value.toUpperCase());
                  setFormErrors((prev) => ({ ...prev, section: undefined }));
                }}
                placeholder="A"
                maxLength={5}
                disabled={assigning}
              />
              {formErrors.section && (
                <span className="courses-error-hint">{formErrors.section}</span>
              )}
            </div>
          </div>

          <div className="courses-assign-actions">
            <Button
              variant="primary"
              type="submit"
              isLoading={assigning}
              disabled={assigning || loadingInitial}
              id="btn-submit-assign-course"
            >
              Assign Faculty to Offering
            </Button>
          </div>
        </form>
      </div>

      {/* ── Assigned Offerings Section ── */}
      <div className="courses-card courses-table-section">
        {/* Filter and Control Bar */}
        <div className="courses-table-controls">
          <div className="courses-filters-grid">
            {/* Semester Selector */}
            <div className="courses-filter-item">
              <label className="courses-filter-label" htmlFor="view-semester">
                Viewing Semester
              </label>
              <select
                id="view-semester"
                className="courses-filter-select"
                value={viewSemesterId}
                onChange={(e) => setViewSemesterId(e.target.value)}
                disabled={loadingOfferings || semesters.length === 0}
              >
                {semesters.map((sem) => (
                  <option key={sem._id} value={sem._id}>
                    {sem.name} {sem.status === 'active' ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="courses-filter-item">
              <label className="courses-filter-label" htmlFor="filter-department">
                Department
              </label>
              <select
                id="filter-department"
                className="courses-filter-select"
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                disabled={isHod}
              >
                {!isHod && <option value="">All Departments</option>}
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="courses-filter-item courses-search-item">
              <label className="courses-filter-label" htmlFor="course-search">
                Search Offerings
              </label>
              <input
                id="course-search"
                type="text"
                className="courses-filter-input"
                placeholder="Search course code, name, faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Summary Bar */}
          <div className="courses-summary-bar">
            <span className="courses-summary-count">
              Showing <strong>{filteredOfferings.length}</strong> of{' '}
              <strong>{offerings.length}</strong> assigned course offerings in{' '}
              <strong>{selectedViewSemester?.name || 'Selected Semester'}</strong>
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                className="courses-reset-btn"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Offerings Table */}
        {loadingOfferings ? (
          <div className="courses-loading-state">
            <span className="courses-spinner">
              <Icon name="spinner" size={24} />
            </span>
            <p>Loading course offerings...</p>
          </div>
        ) : offeringsError ? (
          <div className="courses-error-state">
            <p className="courses-error-text">{offeringsError}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchOfferings(viewSemesterId)}
            >
              Retry
            </Button>
          </div>
        ) : filteredOfferings.length === 0 ? (
          <div className="courses-empty-state">
            <p className="courses-empty-title">
              {hasActiveFilters
                ? 'No course offerings match the selected filters.'
                : 'No courses have been assigned in this semester yet.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                Clear All Filters
              </Button>
            ) : (
              <span className="courses-muted">
                Use the assignment form above to allocate courses to faculty.
              </span>
            )}
          </div>
        ) : (
          <div className="courses-table-wrap">
            <table className="courses-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Course</th>
                  <th style={{ width: '12%' }}>Section</th>
                  <th style={{ width: '26%' }}>Assigned Faculty</th>
                  <th style={{ width: '18%' }}>Department</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOfferings.map((offering) => {
                  const dept = offering.course?.department;
                  const deptName = dept?.name || '—';
                  const deptCode = dept?.code ? ` (${dept.code})` : '';

                  return (
                    <tr key={offering._id} className="courses-table-row">
                      <td>
                        <div className="courses-code-cell">
                          <span className="courses-code-badge">
                            {offering.course?.courseCode}
                          </span>
                          <span className="courses-name-text">
                            {offering.course?.courseName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="courses-section-badge">
                          Section {offering.section || 'A'}
                        </span>
                      </td>
                      <td>
                        <div className="courses-faculty-cell">
                          <span className="courses-faculty-name">
                            {offering.faculty?.name || 'Unassigned'}
                          </span>
                          {offering.faculty?.email && (
                            <span className="courses-faculty-email">
                              {offering.faculty.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="courses-dept-text">
                          {deptName}{deptCode}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Button
                          variant="danger-subtle"
                          size="sm"
                          onClick={() => handleOpenRemoveModal(offering)}
                          id={`btn-remove-offering-${offering._id}`}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Manage Semesters Modal ── */}
      <Modal
        isOpen={semesterModalOpen}
        onClose={() => setSemesterModalOpen(false)}
        title="Manage Academic Semesters"
        size="md"
        footer={
          <div className="courses-modal-footer">
            <Button variant="ghost" onClick={() => setSemesterModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="courses-semester-modal-body">
          <div className="courses-semester-create-box">
            <h4 className="courses-modal-subtitle">Create New Semester</h4>
            <form onSubmit={handleCreateSemester} className="courses-semester-inline-form">
              <input
                type="text"
                className="courses-field-input"
                placeholder="e.g. Spring 2027"
                value={newSemesterName}
                onChange={(e) => setNewSemesterName(e.target.value)}
                disabled={creatingSemester}
              />
              <Button
                variant="primary"
                type="submit"
                isLoading={creatingSemester}
                disabled={creatingSemester}
              >
                Create
              </Button>
            </form>
          </div>

          <div className="courses-semester-list-box">
            <h4 className="courses-modal-subtitle">Configured Semesters ({semesters.length})</h4>
            <div className="courses-semester-chips-grid">
              {semesters.map((sem) => (
                <div key={sem._id} className="courses-semester-card">
                  <div className="courses-semester-card-info">
                    <span className="courses-semester-card-name">{sem.name}</span>
                    <StatusBadge
                      status={sem.status === 'active' ? 'active' : 'inactive'}
                      label={sem.status === 'active' ? 'Active' : 'Inactive'}
                      size="sm"
                    />
                  </div>
                  <div className="courses-semester-card-actions">
                    <Button
                      variant={sem.status === 'active' ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleSemester(sem._id)}
                      isLoading={togglingSemesterId === sem._id}
                      disabled={togglingSemesterId !== null}
                    >
                      {sem.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Remove Offering Confirmation Modal ── */}
      <Modal
        isOpen={Boolean(offeringToRemove)}
        onClose={handleCloseRemoveModal}
        title="Confirm Removal of Course Offering"
        size="md"
        footer={
          <div className="courses-modal-footer">
            <Button
              variant="ghost"
              onClick={handleCloseRemoveModal}
              disabled={removingOffering}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRemove}
              isLoading={removingOffering}
              id="btn-confirm-remove-offering"
            >
              Remove Offering
            </Button>
          </div>
        }
      >
        {offeringToRemove && (
          <div className="courses-remove-dialog-body">
            <div className="courses-remove-warning-banner" role="alert">
              <div className="courses-remove-warning-icon">
                <Icon name="alert" size={20} />
              </div>
              <div className="courses-remove-warning-text">
                <h4>Are you sure you want to remove this assignment?</h4>
                <p>
                  This action will unassign the faculty member from this course section for the
                  specified semester.
                </p>
              </div>
            </div>

            <div className="courses-remove-details-card">
              <div className="courses-remove-detail-row">
                <span className="courses-remove-detail-label">Course</span>
                <span className="courses-remove-detail-val">
                  <strong>{offeringToRemove.course?.courseCode}</strong> — {offeringToRemove.course?.courseName}
                </span>
              </div>
              <div className="courses-remove-detail-row">
                <span className="courses-remove-detail-label">Section</span>
                <span className="courses-remove-detail-val">
                  Section {offeringToRemove.section || 'A'}
                </span>
              </div>
              <div className="courses-remove-detail-row">
                <span className="courses-remove-detail-label">Assigned Faculty</span>
                <span className="courses-remove-detail-val">
                  {offeringToRemove.faculty?.name} ({offeringToRemove.faculty?.email})
                </span>
              </div>
              <div className="courses-remove-detail-row">
                <span className="courses-remove-detail-label">Semester</span>
                <span className="courses-remove-detail-val">
                  {selectedViewSemester?.name || offeringToRemove.semester?.name}
                </span>
              </div>
            </div>

            <div className="courses-remove-safety-notice">
              <p>
                <strong>Institutional Safeguards:</strong>
              </p>
              <ul>
                <li>The base course entry will remain preserved in the university catalog.</li>
                <li>No Google Drive files or cloud archive folders will be deleted.</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Courses;
