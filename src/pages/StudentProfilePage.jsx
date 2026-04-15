import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Modal from '../components/Modal';
import StitchDesktopShell from '../components/StitchDesktopShell';
import { DAY_ABBREVIATIONS } from '../lib/constants';
import { getStudentDrilldownProfile } from '../lib/insights';

function formatMonthKey(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getRiskTone(profile) {
  const attendance = profile.latestAttendance?.percentage ?? 100;
  const exam = profile.latestExam?.percentage ?? 100;
  if (attendance < 75 || exam < 35) return { className: 'stitch-directory-status--danger', label: 'Needs Support' };
  if (attendance < 85 || exam < 55) return { className: 'stitch-directory-status--neutral', label: 'Monitor' };
  return { className: 'stitch-directory-status--good', label: 'On Track' };
}

function parseCriteria(search) {
  const params = new URLSearchParams(search);
  return {
    id: params.get('id') || '',
    classValue: params.get('class') || '',
    section: params.get('section') || '',
    rollNo: params.get('roll') || '',
    name: params.get('name') || '',
  };
}

export default function StudentProfilePage({ currentUser, onLogout, searchQuery, onSearchChange, academicYear, onAcademicYearChange, academicYearOptions }) {
  const location = useLocation();
  const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState(null);

  const criteria = useMemo(() => parseCriteria(location.search), [location.search]);
  const profile = useMemo(
    () => getStudentDrilldownProfile(criteria),
    [criteria.classValue, criteria.id, criteria.name, criteria.rollNo, criteria.section],
  );

  if (!profile) {
    return (
      <StitchDesktopShell
        activeNav="students"
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search students"
        academicYear={academicYear}
        onAcademicYearChange={onAcademicYearChange}
        academicYearOptions={academicYearOptions}
        onLogout={onLogout}
        profileName={currentUser}
        profileRole="Signed In User"
      >
        <main className="stitch-content-canvas">
          <section className="stitch-reports-shell">
            <div className="stitch-reports-head">
              <h3>Student Profile</h3>
            </div>
            <div className="stitch-directory-row stitch-directory-row--empty">
              Student profile not found. It may have been renamed or moved.
            </div>
            <div className="mt-3">
              <Link to="/students" className="stitch-inline-guide-link">Back to Student Directory</Link>
            </div>
          </section>
        </main>
      </StitchDesktopShell>
    );
  }

  const riskTone = getRiskTone(profile);

  return (
    <StitchDesktopShell
      activeNav="students"
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search students"
      academicYear={academicYear}
      onAcademicYearChange={onAcademicYearChange}
      academicYearOptions={academicYearOptions}
      onLogout={onLogout}
      profileName={currentUser}
      profileRole="Signed In User"
    >
      <main className="stitch-content-canvas">
        <section className="stitch-directory-header">
          <div className="stitch-page-heading-copy">
            <h1>{profile.name}</h1>
            <p className="stitch-page-subtitle">Class {profile.classValue}-{profile.section} • Roll {profile.rollNo} • Academic Year {academicYear}</p>
          </div>
          <Link to="/students" className="stitch-directory-edit-student-btn stitch-profile-back-link">
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            <span>Back to Directory</span>
          </Link>
        </section>

        <section className="stitch-directory-metrics">
          <article className="stitch-directory-metric-card">
            <p>Latest Attendance</p>
            <h3>{profile.latestAttendance ? `${profile.latestAttendance.percentage}%` : 'N/A'}</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>Exam Average</p>
            <h3>{profile.examAverage != null ? `${profile.examAverage}%` : 'N/A'}</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>Current Grade</p>
            <h3>{profile.latestExam?.grade || '-'}</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>Profile Status</p>
            <h3>
              <span className={`stitch-directory-status ${riskTone.className}`}>{riskTone.label}</span>
            </h3>
          </article>
        </section>

        <section className="stitch-reports-shell stitch-student-profile-shell">
          <div className="stitch-reports-head">
            <h3>Attendance by Month</h3>
            <span>{profile.monthlyAttendance.length} months tracked</span>
          </div>

          {profile.monthlyAttendance.length === 0 ? (
            <div className="stitch-directory-row stitch-directory-row--empty">No attendance records found for this student.</div>
          ) : (
            <div className="stitch-student-profile-attendance-list">
              {profile.monthlyAttendance.map((month) => (
                <article key={month.monthKey} className="stitch-student-profile-attendance-row">
                  <div>
                    <h4>{formatMonthKey(month.monthKey)}</h4>
                    <p>{month.attended} / {month.totalPeriods} periods present</p>
                  </div>
                  <div className="stitch-directory-attendance">
                    <div className="stitch-directory-bar"><span style={{ width: `${month.percentage}%` }} /></div>
                    <strong>{month.percentage}%</strong>
                  </div>
                  <button type="button" className="stitch-directory-edit-student-btn" onClick={() => setSelectedAttendanceMonth(month)}>
                    <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
                    <span>View Calendar</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="stitch-reports-shell stitch-student-profile-shell">
          <div className="stitch-reports-head">
            <h3>Exam History</h3>
            <span>{profile.examHistory.length} exams evaluated</span>
          </div>

          {profile.examHistory.length === 0 ? (
            <div className="stitch-directory-row stitch-directory-row--empty">No exam records found for this student.</div>
          ) : (
            <div className="stitch-student-profile-exam-list">
              {profile.examHistory.map((exam) => (
                <article key={exam.exam} className="stitch-student-profile-exam-row">
                  <div>
                    <h4>{exam.exam}</h4>
                    <p>Grade {exam.grade}</p>
                  </div>
                  <div>
                    <small>FA1</small>
                    <strong>{exam.raw.fa1 || '-'} /20</strong>
                  </div>
                  <div>
                    <small>FA2</small>
                    <strong>{exam.raw.fa2 || '-'} /20</strong>
                  </div>
                  <div>
                    <small>Exam</small>
                    <strong>{exam.raw.exam40 || '-'} /40</strong>
                  </div>
                  <div>
                    <small>Oral</small>
                    <strong>{exam.raw.oral || '-'} /10</strong>
                  </div>
                  <div>
                    <small>Total</small>
                    <strong>{exam.converted.total} /50</strong>
                  </div>
                  <div>
                    <small>Percent</small>
                    <strong>{exam.percentage}%</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Modal
        title={selectedAttendanceMonth ? `${profile.name} — ${formatMonthKey(selectedAttendanceMonth.monthKey)}` : 'Attendance Calendar'}
        isOpen={Boolean(selectedAttendanceMonth)}
        onClose={() => setSelectedAttendanceMonth(null)}
        size="modal-dialog modal-xl"
      >
        {selectedAttendanceMonth ? (
          <div className="stitch-report-calendar-modal">
            <div className="stitch-report-calendar-topline">
              <p>Attendance: {selectedAttendanceMonth.percentage}% ({selectedAttendanceMonth.attended}/{selectedAttendanceMonth.totalPeriods})</p>
              <div className="stitch-calendar-legend">
                <span className="is-present">P</span>
                <span className="is-absent">A</span>
                <span className="is-unmarked">--</span>
                <span className="is-holiday">GH</span>
                <span className="is-off">Sun</span>
              </div>
            </div>

            <div className="stitch-calendar-weekdays">
              {DAY_ABBREVIATIONS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="stitch-calendar-grid">
              {selectedAttendanceMonth.calendarCells.map((cell) => (
                <div key={cell.key} className={`stitch-calendar-day ${cell.isEmpty ? 'is-empty' : `is-${cell.state}`}`}>
                  {cell.isEmpty ? null : (
                    <>
                      <small>{cell.dayNumber}</small>
                      <strong>{cell.label}</strong>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
    </StitchDesktopShell>
  );
}
