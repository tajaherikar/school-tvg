import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import StitchDesktopShell from '../components/StitchDesktopShell';
import { getDashboardInsights } from '../lib/insights';

function getInitials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getGreetingByHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDisplayName(name) {
  if (!name) return 'Professor';
  return name.startsWith('Prof.') ? name : `Prof. ${name}`;
}

const QUOTES_OF_THE_DAY = [
  'Teaching is the one profession that creates all other professions.',
  'Small progress each day adds up to big results in every classroom.',
  'An inspired teacher inspires a lifetime of curiosity.',
  'Consistency in teaching creates confidence in learning.',
  'The future is shaped by what happens in class today.',
  'Every lesson is a chance to open a new door for a student.',
  'Great teachers do not just teach subjects; they teach possibility.',
];

function getQuoteOfTheDay(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayIndex = Math.floor((date - startOfYear) / 86400000);
  return QUOTES_OF_THE_DAY[dayIndex % QUOTES_OF_THE_DAY.length];
}

export default function DashboardPage({ currentUser, onLogout, searchQuery, onSearchChange, academicYear, onAcademicYearChange, academicYearOptions }) {
  const insights = useMemo(() => getDashboardInsights(), []);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const greeting = getGreetingByHour(new Date().getHours());
  const displayName = getDisplayName(currentUser);
  const quoteOfTheDay = getQuoteOfTheDay();
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const toolCards = [
    { to: '/attendance', icon: 'how_to_reg', label: 'Mark Attendance', keywords: 'attendance mark present absent' },
    { to: '/results', icon: 'edit_note', label: 'Input Grades', keywords: 'results exams grades marks' },
    { to: '/students', icon: 'analytics', label: 'View Directory', keywords: 'students directory records' },
  ];

  const filteredToolCards = useMemo(() => {
    if (!normalizedQuery) return toolCards;
    return toolCards.filter((card) => `${card.label} ${card.keywords}`.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  const filteredPerformance = useMemo(() => {
    if (!normalizedQuery) return insights.recentPerformance;
    return insights.recentPerformance.filter((student) => {
      const haystack = `${student.name} ${student.classValue}-${student.section} ${student.grade || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [insights.recentPerformance, normalizedQuery]);

  return (
    <StitchDesktopShell
      activeNav="dashboard"
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search students, exams, or lessons..."
      academicYear={academicYear}
      onAcademicYearChange={onAcademicYearChange}
      academicYearOptions={academicYearOptions}
      onLogout={onLogout}
      profileName={currentUser}
      profileRole="Signed In User"
    >
      <main className="stitch-content-canvas">
        <header className="stitch-dash-welcome">
          <div className="stitch-page-heading-copy">
            <h1>{`${greeting}, ${displayName}`}</h1>
            <p className="stitch-page-subtitle">{`Quote of the Day: "${quoteOfTheDay}"`}</p>
          </div>
          <div className="stitch-date-chip">
            <span className="material-symbols-outlined">calendar_today</span>
            <div>
              <strong>{today}</strong>
              <small>Academic Year {academicYear}</small>
            </div>
          </div>
        </header>

        <section className="stitch-dash-top-grid">
          <article className="stitch-dash-circle-card">
            <div className="stitch-circle-progress">
              <svg viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eff4ff" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#004ac6" strokeDasharray={`${insights.averageAttendance}, 100`} strokeLinecap="round" strokeWidth="3" />
              </svg>
              <div>
                <strong>{insights.averageAttendance}%</strong>
                <span>Attendance</span>
              </div>
            </div>
            <h3>Students Present Trend</h3>
            <p>{insights.presentTodayEstimate} estimated present based on saved attendance records.</p>
          </article>

          <article className="stitch-dash-panel-card">
            <div className="stitch-dash-panel-head">
              <div>
                <h3>Average Class GPA</h3>
                <p>Derived from saved results</p>
              </div>
              <span className="stitch-pill-green">+0.2</span>
            </div>
            <div className="stitch-bar-sparkline">
              <span style={{ height: '40%' }} />
              <span style={{ height: '60%' }} />
              <span style={{ height: '55%' }} />
              <span style={{ height: '75%' }} />
              <span style={{ height: '85%' }} />
              <span className="is-strong" style={{ height: '95%' }} />
            </div>
            <div className="stitch-dash-panel-foot">
              <strong>{insights.averageGpa}</strong>
              <p>Equivalent on a 4.0 scale from exam percentages</p>
            </div>
          </article>
        </section>

        <section className='mb-4'>
          <div className="stitch-section-head">
            <h3>Quick Tools</h3>
            <div />
          </div>
          <div className="stitch-tool-grid">
            {filteredToolCards.map((card) => (
              <Link key={card.to} to={card.to} className="stitch-tool-card">
                <span className="material-symbols-outlined">{card.icon}</span>
                <strong>{card.label}</strong>
              </Link>
            ))}
          </div>
          {normalizedQuery && filteredToolCards.length === 0 ? <p className="text-muted mt-2 mb-0">No tools matched your search.</p> : null}
        </section>

        <section className="stitch-performance-list">
          <h3>Recent Academic Performance</h3>
          <div className="stitch-performance-cards">
            {filteredPerformance.length === 0 ? (
              <div className="stitch-performance-card">
                <div>
                  <p>{normalizedQuery ? 'No performance records matched your search.' : 'No saved results yet.'}</p>
                  <small>{normalizedQuery ? 'Try another student/class keyword.' : 'Add exam marks to populate the dashboard.'}</small>
                </div>
              </div>
            ) : (
              filteredPerformance.map((student) => (
                <div key={student.id} className="stitch-performance-card">
                  <div className="stitch-performance-student">
                    <span>{getInitials(student.name)}</span>
                    <div>
                      <p>{student.name}</p>
                      <small>Class {student.classValue}-{student.section}</small>
                    </div>
                  </div>
                  <div>
                    <small>Grade Progress</small>
                    <div className="stitch-grade-row">
                      <div className="stitch-grade-bar"><span style={{ width: `${student.resultPercent || 0}%` }} /></div>
                      <strong>{student.grade || '-'}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </StitchDesktopShell>
  );
}