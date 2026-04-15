import { Link } from 'react-router-dom';
import StitchMobileChrome from './StitchMobileChrome';
import TopBarUtilityActions from './TopBarUtilityActions';

const profileImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBu6EM6H0wRGvdXOmEJIe2bUeFZFn-zLW1m2S7ugkKDu43l2JYkLpY7_hK9RpMyuHtDqwvKWnmuHxqquN-MhLAYdNvHeJJffxLrOL1-0X2V_9FoYrMIk9mui8-2ll8GPDORuzv5nyqyytd5lq9RB9f3EgpiJ7OEtXt-yHM68eANJ1tWq-xwPgFNhL9s40_M-VtVyJJBg9J1NhpvIw2Mxaea1zz-HOUHz6CkXNs77SgSDvb-FgoVeBhAU2RzyfiSFuzhUORS3ZxcxAA';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { key: 'attendance', label: 'Attendance', to: '/attendance', icon: 'event_available' },
  { key: 'results', label: 'Exams', to: '/results', icon: 'assignment' },
  { key: 'students', label: 'Students', to: '/students', icon: 'group' },
  { key: 'reports', label: 'Reports', to: '/reports', icon: 'assessment' },
];

export default function StitchDesktopShell({
  activeNav,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  academicYear,
  onAcademicYearChange,
  academicYearOptions = [],
  onNewEntry,
  onLogout,
  newEntryLabel = 'New Entry',
  profileName = 'Alex Thompson',
  profileRole = 'Senior Mathematics Lead',
  children,
}) {
  return (
    <div className="tool-shell tool-shell--stitch-exact">
      <StitchMobileChrome
        activeNav={activeNav}
        academicYear={academicYear}
        onAcademicYearChange={onAcademicYearChange}
        academicYearOptions={academicYearOptions}
        onNewEntry={onNewEntry}
        newEntryLabel={newEntryLabel}
      />

      <aside className="stitch-side-nav d-none d-lg-flex">
        <div className="stitch-brand-wrap">
          <div className="stitch-brand-icon">
            <span className="material-symbols-outlined">school</span>
          </div>
          <div>
            <span className="stitch-brand-title">ScholarSync</span>
            <p className="stitch-brand-tag">Academic Curator</p>
          </div>
        </div>

        <nav className="stitch-side-links">
          {navItems.map((item) => (
            <Link key={item.key} to={item.to} className={`stitch-side-link ${activeNav === item.key ? 'stitch-side-link--active' : ''}`}>
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {typeof onNewEntry === 'function' ? (
          <div className="stitch-side-cta-wrap">
            <button type="button" className="stitch-side-cta" onClick={onNewEntry}>
              <span className="material-symbols-outlined">add</span>
              <span>{newEntryLabel}</span>
            </button>
          </div>
        ) : null}
      </aside>

      <header className="stitch-top-nav">
        <div className="stitch-search-wrap">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="stitch-top-actions">
          {academicYear && typeof onAcademicYearChange === 'function' ? (
            <label className="stitch-year-switcher" aria-label="Academic year selector">
              <span className="material-symbols-outlined">school</span>
              <select value={academicYear} onChange={(event) => onAcademicYearChange(event.target.value)}>
                {academicYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          ) : null}
          <TopBarUtilityActions searchQuery={searchQuery} onSearchChange={onSearchChange} onLogout={onLogout} />
          <div className="stitch-profile-mini d-none d-sm-flex">
            <div>
              <p>{profileName}</p>
              <small>{profileRole}</small>
            </div>
            <img src={profileImage} alt="Teacher" />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}