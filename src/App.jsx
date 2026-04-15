import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import ResultsPage from './pages/ResultsPage';
import StudentDirectoryPage from './pages/StudentDirectoryPage';
import StudentProfilePage from './pages/StudentProfilePage';
import ReportsPage from './pages/ReportsPage';
import LoginPage from './pages/LoginPage';
import { getCurrentAuthUser, logout } from './lib/auth';
import { ACADEMIC_YEAR, ACADEMIC_YEAR_OPTIONS } from './lib/constants';

const ACADEMIC_YEAR_STORAGE_KEY = 'tvg_selected_academic_year';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentAuthUser()?.username || '');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [academicYear, setAcademicYear] = useState(() => window.localStorage.getItem(ACADEMIC_YEAR_STORAGE_KEY) || ACADEMIC_YEAR);

  function handleAcademicYearChange(nextYear) {
    setAcademicYear(nextYear);
    window.localStorage.setItem(ACADEMIC_YEAR_STORAGE_KEY, nextYear);
  }

  function handleLogout() {
    logout();
    setCurrentUser('');
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLoginSuccess={setCurrentUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/"
        element={<DashboardPage currentUser={`Prof. ${currentUser}`} onLogout={handleLogout} searchQuery={globalSearchQuery} onSearchChange={setGlobalSearchQuery} academicYear={academicYear} onAcademicYearChange={handleAcademicYearChange} academicYearOptions={ACADEMIC_YEAR_OPTIONS} />}
      />
      <Route
        path="/dashboard"
        element={<DashboardPage currentUser={`Prof. ${currentUser}`} onLogout={handleLogout} searchQuery={globalSearchQuery} onSearchChange={setGlobalSearchQuery} academicYear={academicYear} onAcademicYearChange={handleAcademicYearChange} academicYearOptions={ACADEMIC_YEAR_OPTIONS} />}
      />
      <Route
        path="/attendance"
        element={<AttendancePage currentUser={`Prof. ${currentUser}`} onLogout={handleLogout} searchQuery={globalSearchQuery} onSearchChange={setGlobalSearchQuery} academicYear={academicYear} onAcademicYearChange={handleAcademicYearChange} academicYearOptions={ACADEMIC_YEAR_OPTIONS} />}
      />
      <Route
        path="/results"
        element={<ResultsPage currentUser={`Prof. ${currentUser}`} onLogout={handleLogout} searchQuery={globalSearchQuery} onSearchChange={setGlobalSearchQuery} academicYear={academicYear} onAcademicYearChange={handleAcademicYearChange} academicYearOptions={ACADEMIC_YEAR_OPTIONS} />}
      />
      <Route
        path="/students"
        element={<StudentDirectoryPage currentUser={`Prof. ${currentUser}`} onLogout={handleLogout} searchQuery={globalSearchQuery} onSearchChange={setGlobalSearchQuery} academicYear={academicYear} onAcademicYearChange={handleAcademicYearChange} academicYearOptions={ACADEMIC_YEAR_OPTIONS} />}
      />
      <Route
        path="/students/profile"
        element={<StudentProfilePage currentUser={`Prof. ${currentUser}`} onLogout={handleLogout} searchQuery={globalSearchQuery} onSearchChange={setGlobalSearchQuery} academicYear={academicYear} onAcademicYearChange={handleAcademicYearChange} academicYearOptions={ACADEMIC_YEAR_OPTIONS} />}
      />
      <Route
        path="/reports"
        element={<ReportsPage currentUser={`Prof. ${currentUser}`} onLogout={handleLogout} searchQuery={globalSearchQuery} onSearchChange={setGlobalSearchQuery} academicYear={academicYear} onAcademicYearChange={handleAcademicYearChange} academicYearOptions={ACADEMIC_YEAR_OPTIONS} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
