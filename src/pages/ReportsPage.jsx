import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import StitchDesktopShell from '../components/StitchDesktopShell';
import { getUnifiedStudentDirectory } from '../lib/insights';
import { readJson } from '../lib/storage';
import { calculateAttendanceRow, getDayStatus, getDaysInMonth } from '../features/attendance/utils';
import { getStudentResult } from '../features/results/utils';
import { DAY_ABBREVIATIONS } from '../lib/constants';

const EXAM_ORDER = { SA1: 1, SA2: 2 };

function getStorageKeys(prefix) {
  if (typeof window === 'undefined') return [];

  const keys = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

function formatMonthKey(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function buildMonthCalendar(monthKey, studentId, config, marks) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = getDaysInMonth(monthKey);
  const firstWeekDay = new Date(year, month - 1, 1).getDay();
  const cells = Array.from({ length: firstWeekDay }, (_, index) => ({ key: `blank-${index}`, isEmpty: true }));

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const dayStatus = getDayStatus(dayNumber, monthKey, config.periodDays || {}, config.holidays || {});
    const mark = marks[studentId]?.[dayNumber] || '';
    let state = 'empty';
    let label = '-';

    if (dayStatus === 'sunday') {
      state = 'off';
      label = 'Sun';
    } else if (dayStatus === 'holiday') {
      state = 'holiday';
      label = 'GH';
    } else if (dayStatus === 'period') {
      if (mark === 'P') {
        state = 'present';
        label = 'P';
      } else if (mark === 'A') {
        state = 'absent';
        label = 'A';
      } else {
        state = 'unmarked';
        label = '--';
      }
    }

    cells.push({
      key: `${monthKey}-${dayNumber}`,
      dayNumber,
      state,
      label,
      isEmpty: false,
    });
  }

  return cells;
}

function buildStudentWiseReports(students) {
  return students.map((student) => {
    const classKey = `${student.classValue}_${student.section}`;
    const identityKey = `${String(student.rollNo).toLowerCase()}::${student.name.toLowerCase()}`;

    const attendanceStudents = readJson(`tvg_att_students_${classKey}`, []);
    const attendanceMatch = attendanceStudents.find(
      (item) => `${String(item.rollNo).toLowerCase()}::${item.name.toLowerCase()}` === identityKey,
    );

    const monthKeys = getStorageKeys(`tvg_att_config_${classKey}_`)
      .map((key) => key.replace(`tvg_att_config_${classKey}_`, ''))
      .sort()
      .slice(-4);

    const monthlyAttendance = monthKeys
      .map((monthKey) => {
        if (!attendanceMatch) return null;
        const config = readJson(`tvg_att_config_${classKey}_${monthKey}`, {});
        const marks = readJson(`tvg_att_marks_${classKey}_${monthKey}`, {});
        const stats = calculateAttendanceRow(
          attendanceMatch.id,
          getDaysInMonth(monthKey),
          monthKey,
          config.periodDays || {},
          config.holidays || {},
          marks,
        );

        return {
          monthKey,
          percentage: stats.percentage,
          attended: stats.attended,
          totalPeriods: stats.totalPeriods,
          calendarCells: buildMonthCalendar(monthKey, attendanceMatch.id, config, marks),
        };
      })
      .filter(Boolean);

    const resultsStudents = readJson(`tvg_res_students_${classKey}`, []);
    const resultMatch = resultsStudents.find(
      (item) => `${String(item.rollNo).toLowerCase()}::${item.name.toLowerCase()}` === identityKey,
    );

    const examKeys = getStorageKeys(`tvg_res_marks_${classKey}_`)
      .map((key) => key.replace(`tvg_res_marks_${classKey}_`, ''))
      .sort((left, right) => (EXAM_ORDER[left] || 99) - (EXAM_ORDER[right] || 99));

    const examHistory = examKeys
      .map((exam) => {
        if (!resultMatch) return null;
        const marks = readJson(`tvg_res_marks_${classKey}_${exam}`, {});
        const result = getStudentResult(marks[resultMatch.id] || {});
        if (!result) return null;

        return {
          exam,
          percentage: Number(result.percentage),
          grade: result.gradeInfo.grade,
        };
      })
      .filter(Boolean);

    const latestAttendance = monthlyAttendance.at(-1)?.percentage ?? null;
    const latestExam = examHistory.at(-1) || null;
    const isAtRisk = (latestAttendance ?? 100) < 75 || (latestExam?.percentage ?? 100) < 35;

    return {
      ...student,
      monthlyAttendance,
      examHistory,
      latestAttendance,
      latestExam,
      isAtRisk,
    };
  });
}

function toFixedSafe(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '0.0';
  return Number(value).toFixed(digits);
}

function getClassSummaries(students) {
  const group = new Map();

  students.forEach((student) => {
    const key = `${student.classValue}-${student.section}`;
    if (!group.has(key)) {
      group.set(key, {
        classKey: key,
        students: 0,
        attendanceValues: [],
        resultValues: [],
        pass: 0,
        fail: 0,
      });
    }

    const row = group.get(key);
    row.students += 1;
    if (student.attendanceRate != null) row.attendanceValues.push(student.attendanceRate);
    if (student.resultPercent != null) {
      row.resultValues.push(student.resultPercent);
      if (student.resultPercent >= 35) row.pass += 1;
      else row.fail += 1;
    }
  });

  return Array.from(group.values())
    .map((row) => {
      const attendanceAvg = row.attendanceValues.length
        ? row.attendanceValues.reduce((sum, value) => sum + value, 0) / row.attendanceValues.length
        : 0;
      const resultAvg = row.resultValues.length
        ? row.resultValues.reduce((sum, value) => sum + value, 0) / row.resultValues.length
        : 0;

      return {
        classKey: row.classKey,
        students: row.students,
        attendanceAvg,
        resultAvg,
        pass: row.pass,
        fail: row.fail,
        evaluated: row.resultValues.length,
      };
    })
    .sort((a, b) => a.classKey.localeCompare(b.classKey, undefined, { numeric: true }));
}

export default function ReportsPage({ currentUser, onLogout, searchQuery, onSearchChange, academicYear, onAcademicYearChange, academicYearOptions }) {
  const [selectedStudentReport, setSelectedStudentReport] = useState(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const allStudents = useMemo(() => getUnifiedStudentDirectory(), []);
  const classSummaries = useMemo(() => getClassSummaries(allStudents), [allStudents]);
  const studentWiseReports = useMemo(() => buildStudentWiseReports(allStudents), [allStudents]);

  const classFilterOptions = useMemo(
    () => classSummaries.map((row) => row.classKey),
    [classSummaries],
  );

  const scopedStudents = useMemo(
    () => (selectedClassFilter === 'ALL'
      ? allStudents
      : allStudents.filter((student) => `${student.classValue}-${student.section}` === selectedClassFilter)),
    [allStudents, selectedClassFilter],
  );

  const scopedClassSummaries = useMemo(
    () => (selectedClassFilter === 'ALL'
      ? classSummaries
      : classSummaries.filter((row) => row.classKey === selectedClassFilter)),
    [classSummaries, selectedClassFilter],
  );

  const scopedStudentWiseReports = useMemo(
    () => (selectedClassFilter === 'ALL'
      ? studentWiseReports
      : studentWiseReports.filter((student) => `${student.classValue}-${student.section}` === selectedClassFilter)),
    [selectedClassFilter, studentWiseReports],
  );

  const filteredClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return scopedClassSummaries;
    return scopedClassSummaries.filter((row) => row.classKey.toLowerCase().includes(query));
  }, [scopedClassSummaries, searchQuery]);

  const filteredStudentReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return scopedStudentWiseReports;
    return scopedStudentWiseReports.filter((student) => {
      const haystack = `${student.name} ${student.rollNo} ${student.classValue}-${student.section}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [scopedStudentWiseReports, searchQuery]);

  const attendanceValues = scopedStudents.map((student) => student.attendanceRate).filter((value) => value != null);
  const resultValues = scopedStudents.map((student) => student.resultPercent).filter((value) => value != null);
  const atRiskCount = scopedStudents.filter((student) => (student.attendanceRate ?? 100) < 75 || (student.resultPercent ?? 100) < 35).length;

  const overallAttendance = attendanceValues.length
    ? attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length
    : 0;
  const overallResult = resultValues.length
    ? resultValues.reduce((sum, value) => sum + value, 0) / resultValues.length
    : 0;

  return (
    <StitchDesktopShell
      activeNav="reports"
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search class reports (e.g., 10-A)..."
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
            <h1>Academic Reports</h1>
            <p className="stitch-page-subtitle">Class-wise summaries generated from attendance and exam entries for Academic Year {academicYear}.</p>
          </div>
        </section>

        <section className="stitch-directory-metrics">
          <article className="stitch-directory-metric-card">
            <p>Total Classes</p>
            <h3>{scopedClassSummaries.length}</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>Overall Attendance</p>
            <h3>{toFixedSafe(overallAttendance)}%</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>Overall Result Avg</p>
            <h3>{toFixedSafe(overallResult)}%</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>At Risk Students</p>
            <h3>{atRiskCount}</h3>
          </article>
        </section>

        <section className="stitch-reports-shell">
          <div className="stitch-reports-head">
            <h3>Class Performance Report</h3>
            <div className="stitch-reports-head-controls">
              <select
                className="stitch-records-filter-select"
                value={selectedClassFilter}
                onChange={(event) => setSelectedClassFilter(event.target.value)}
                aria-label="Filter reports by class"
              >
                <option value="ALL">All Classes</option>
                {classFilterOptions.map((option) => (
                  <option key={option} value={option}>Class {option}</option>
                ))}
              </select>
              <span>{filteredClasses.length} class records</span>
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="stitch-directory-row stitch-directory-row--empty">No class reports found for this filter.</div>
          ) : (
            <div className="stitch-reports-list">
              {filteredClasses.map((row) => (
                <article key={row.classKey} className="stitch-reports-card">
                  <div>
                    <h4>Class {row.classKey}</h4>
                    <p>{row.students} students</p>
                  </div>
                  <div>
                    <small>Attendance</small>
                    <strong>{toFixedSafe(row.attendanceAvg)}%</strong>
                  </div>
                  <div>
                    <small>Exam Average</small>
                    <strong>{toFixedSafe(row.resultAvg)}%</strong>
                  </div>
                  <div>
                    <small>Pass / Fail</small>
                    <strong>{row.pass} / {row.fail}</strong>
                  </div>
                  <div>
                    <small>Evaluated</small>
                    <strong>{row.evaluated}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="stitch-reports-shell stitch-student-reports-shell">
          <div className="stitch-reports-head">
            <h3>Student-wise Detailed Report</h3>
            <span>{filteredStudentReports.length} students</span>
          </div>

          {filteredStudentReports.length === 0 ? (
            <div className="stitch-directory-row stitch-directory-row--empty">No student-wise reports found for this filter.</div>
          ) : (
            <div className="stitch-student-report-list">
              {filteredStudentReports.map((student) => (
                <article
                  key={student.id}
                  className="stitch-student-report-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedStudentReport(student)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedStudentReport(student);
                    }
                  }}
                >
                  <div>
                    <h4>{student.name}</h4>
                    <p>Class {student.classValue}-{student.section} • Roll {student.rollNo}</p>
                  </div>
                  <div>
                    <small>Month-wise Attendance</small>
                    <strong>
                      {student.monthlyAttendance.length > 0
                        ? student.monthlyAttendance
                            .map((row) => `${formatMonthKey(row.monthKey)} ${row.percentage}%`)
                            .join(' | ')
                        : 'No monthly attendance records'}
                    </strong>
                  </div>
                  <div>
                    <small>Exam-wise Performance</small>
                    <strong>
                      {student.examHistory.length > 0
                        ? student.examHistory
                            .map((exam) => `${exam.exam}: ${exam.percentage.toFixed(1)}% (${exam.grade})`)
                            .join(' | ')
                        : 'No exam results'}
                    </strong>
                  </div>
                  <div>
                    <small>Status</small>
                    <strong className={student.isAtRisk ? 'stitch-risk-text' : 'stitch-ok-text'}>
                      {student.isAtRisk ? 'Needs Attention' : 'On Track'}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="stitch-reports-shell stitch-report-suggestions-shell">
          <div className="stitch-reports-head">
            <h3>Recommended Next Reports</h3>
            <span>Feature ideas</span>
          </div>
          <ul className="stitch-report-suggestions">
            <li>Subject-wise weakness report (topic-level low scores by class and student).</li>
            <li>Attendance-risk predictor (students trending below 75% in coming months).</li>
            <li>Progress delta report (SA1 to SA2 growth/decline by student).</li>
            <li>Top improvers and top maintainers leaderboard month-wise.</li>
            <li>Parent communication list (auto-list students needing follow-up this week).</li>
          </ul>
        </section>
      </main>

      <Modal
        title={selectedStudentReport ? `${selectedStudentReport.name} Attendance Calendar` : 'Attendance Calendar'}
        isOpen={Boolean(selectedStudentReport)}
        onClose={() => setSelectedStudentReport(null)}
        size="modal-dialog modal-xl"
      >
        {selectedStudentReport ? (
          <div className="stitch-report-calendar-modal">
            <div className="stitch-report-calendar-topline">
              <p>
                Class {selectedStudentReport.classValue}-{selectedStudentReport.section} • Roll {selectedStudentReport.rollNo}
              </p>
              <div className="stitch-calendar-legend">
                <span className="is-present">P Present</span>
                <span className="is-absent">A Absent</span>
                <span className="is-holiday">GH Holiday</span>
                <span className="is-off">Sun Sunday</span>
              </div>
            </div>

            {selectedStudentReport.monthlyAttendance.length === 0 ? (
              <p className="mb-0 text-muted">No attendance calendars available for this student yet.</p>
            ) : (
              <div className="stitch-report-calendar-list">
                {selectedStudentReport.monthlyAttendance.map((month) => (
                  <section key={month.monthKey} className="stitch-report-calendar-card">
                    <div className="stitch-report-calendar-head">
                      <div>
                        <h4>{formatMonthKey(month.monthKey)}</h4>
                        <p>{month.attended} present out of {month.totalPeriods} tracked periods</p>
                      </div>
                      <strong>{month.percentage}%</strong>
                    </div>

                    <div className="stitch-calendar-weekdays">
                      {DAY_ABBREVIATIONS.map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>

                    <div className="stitch-calendar-grid">
                      {month.calendarCells.map((cell) => (
                        <div key={cell.key} className={`stitch-calendar-day ${cell.isEmpty ? 'is-empty' : `is-${cell.state}`}`}>
                          {!cell.isEmpty ? (
                            <>
                              <small>{cell.dayNumber}</small>
                              <strong>{cell.label}</strong>
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </StitchDesktopShell>
  );
}
