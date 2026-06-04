import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import DesignationRoute from './routes/DesignationRoute';

// Layouts
import DeanLayout from './layouts/DeanLayout';
import HodLayout from './layouts/HodLayout';
import FacultyLayout from './layouts/FacultyLayout';

// Auth pages
import Login from './pages/auth/Login';

// Dean pages
import DeanDashboard from './pages/dean/Dashboard';
import DeanSubmissions from './pages/dean/Submissions';
import DeanUsers from './pages/dean/Users';
import DeanCourses from './pages/dean/Courses';
import DeanDepartments from './pages/dean/Departments';

// HoD pages
import HodDashboard from './pages/hod/Dashboard';
import HodFaculty from './pages/hod/Faculty';

// Faculty pages
import FacultyDashboard from './pages/faculty/Dashboard';
import CourseFileChecklist from './pages/faculty/CourseFileChecklist';
import CourseTemplates from './pages/faculty/CourseTemplates';
import CourseForm from './pages/faculty/CourseForm';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Dean routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DesignationRoute allowedDesignations={['dean']} />}>
              <Route element={<DeanLayout />}>
                <Route path="/dean/dashboard" element={<DeanDashboard />} />
                <Route path="/dean/submissions" element={<DeanSubmissions />} />
                <Route path="/dean/users" element={<DeanUsers />} />
                <Route path="/dean/courses" element={<DeanCourses />} />
                <Route path="/dean/departments" element={<DeanDepartments />} />
              </Route>
            </Route>
          </Route>

          {/* HoD routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DesignationRoute allowedDesignations={['hod']} />}>
              <Route element={<HodLayout />}>
                <Route path="/hod/dashboard" element={<HodDashboard />} />
                <Route path="/hod/submissions" element={<DeanSubmissions />} />
                <Route path="/hod/faculty" element={<HodFaculty />} />
                <Route path="/hod/courses" element={<DeanCourses />} />
              </Route>
            </Route>
          </Route>

          {/* Faculty routes (Faculty and HoD can access their own forms) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DesignationRoute allowedDesignations={['faculty', 'hod']} />}>
              <Route element={<FacultyLayout />}>
                <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
                <Route path="/faculty/course/:courseId" element={<CourseFileChecklist />} />
                <Route path="/faculty/course/:courseId/templates" element={<CourseTemplates />} />
                <Route path="/course/:courseId/form/:formType" element={<CourseForm />} />
              </Route>
            </Route>
          </Route>

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
