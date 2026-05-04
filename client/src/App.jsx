import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import FacultyLayout from './layouts/FacultyLayout';

// Auth pages
import Login from './pages/auth/Login';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import Submissions from './pages/admin/Submissions';
import Users from './pages/admin/Users';
import Courses from './pages/admin/Courses';

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

          {/* Admin routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allowedRoles={['admin']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/submissions" element={<Submissions />} />
                <Route path="/admin/users" element={<Users />} />
                <Route path="/admin/courses" element={<Courses />} />
              </Route>
            </Route>
          </Route>

          {/* Faculty routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allowedRoles={['faculty']} />}>
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
