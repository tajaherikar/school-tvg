import { Link } from 'react-router-dom';

const profileImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBu6EM6H0wRGvdXOmEJIe2bUeFZFn-zLW1m2S7ugkKDu43l2JYkLpY7_hK9RpMyuHtDqwvKWnmuHxqquN-MhLAYdNvHeJJffxLrOL1-0X2V_9FoYrMIk9mui8-2ll8GPDORuzv5nyqyytd5lq9RB9f3EgpiJ7OEtXt-yHM68eANJ1tWq-xwPgFNhL9s40_M-VtVyJJBg9J1NhpvIw2Mxaea1zz-HOUHz6CkXNs77SgSDvb-FgoVeBhAU2RzyfiSFuzhUORS3ZxcxAA';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { key: 'attendance', label: 'Attendance', to: '/attendance', icon: 'how_to_reg' },
  { key: 'results', label: 'Exams', to: '/results', icon: 'grading' },
  { key: 'students', label: 'Students', to: '/students', icon: 'group' },
  { key: 'reports', label: 'Reports', to: '/reports', icon: 'assessment' },
];

export default function StitchMobileChrome({ activeNav, academicYear, onAcademicYearChange, academicYearOptions = [], onNewEntry, newEntryLabel = 'Add' }) {
  return (
    <>
      <header className="stitch-mobile-topbar d-lg-none">
        <div className="stitch-mobile-brand">
          <div className="stitch-mobile-avatar">
            <img src={profileImage} alt="Teacher" />
          </div>
          <span>The Academic Curator</span>
        </div>
        <div className="stitch-mobile-topbar-actions">
          {academicYear && typeof onAcademicYearChange === 'function' ? (
            <label className="stitch-mobile-year-switcher" aria-label="Academic year selector">
              <span className="material-symbols-outlined">school</span>
              <select value={academicYear} onChange={(event) => onAcademicYearChange(event.target.value)}>
                {academicYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" aria-label="Notifications" className="stitch-mobile-icon-btn">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      {typeof onNewEntry === 'function' ? (
        <button type="button" className="stitch-mobile-fab d-lg-none" onClick={onNewEntry} aria-label={newEntryLabel}>
          <span className="material-symbols-outlined">add</span>
          <span>{newEntryLabel}</span>
        </button>
      ) : null}

      <nav className="stitch-mobile-bottom-nav d-lg-none" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <Link key={item.key} to={item.to} className={`stitch-mobile-nav-item ${activeNav === item.key ? 'is-active' : ''}`}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
