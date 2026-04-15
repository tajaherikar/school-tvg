import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../components/Modal';
import StitchDesktopShell from '../components/StitchDesktopShell';
import { CLASS_OPTIONS, DAY_ABBREVIATIONS, MONTH_NAMES } from '../lib/constants';
import { createId, parseStudentLines, readJson, writeJson } from '../lib/storage';
import { getAttendanceContext, getAttendanceKey } from '../features/attendance/storage';
import {
  buildAttendanceExportRows,
  calculateAttendanceRow,
  cycleDayStatus,
  getDayOfWeek,
  getDayStatus,
  getDaysInMonth,
  getMonthYear,
} from '../features/attendance/utils';

function getTodayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getPlannerStatusLabel(status) {
  if (status === 'period') return 'Period';
  if (status === 'holiday') return 'GH';
  if (status === 'sunday') return 'Sun';
  return 'Work';
}

const defaultDate = getTodayDateValue();

export default function AttendancePage({ currentUser, onLogout, searchQuery, onSearchChange, academicYear, onAcademicYearChange, academicYearOptions }) {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [form, setForm] = useState({
    classValue: '6',
    section: 'A',
    subject: '',
    month: defaultDate.slice(0, 7),
  });
  const [students, setStudents] = useState([]);
  const [periodDays, setPeriodDays] = useState({});
  const [holidays, setHolidays] = useState({});
  const [lateFlags, setLateFlags] = useState({});
  const [marks, setMarks] = useState({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ rollNo: '', name: '' });
  const [bulkText, setBulkText] = useState('');
  const [replaceStudents, setReplaceStudents] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const context = useMemo(() => getAttendanceContext(form), [form]);
  const selectedDay = Number(selectedDate.slice(8, 10));
  const monthMeta = useMemo(() => getMonthYear(form.month), [form.month]);
  const daysInMonth = useMemo(() => getDaysInMonth(form.month), [form.month]);

  useEffect(() => {
    const monthValue = selectedDate.slice(0, 7);
    setForm((current) => (current.month === monthValue ? current : { ...current, month: monthValue }));
  }, [selectedDate]);

  useEffect(() => {
    const loadedStudents = readJson(getAttendanceKey('students', context), []);
    const loadedConfig = readJson(getAttendanceKey('config', context), {});
    const loadedMarks = readJson(getAttendanceKey('marks', context), {});

    setStudents(loadedStudents);
    setPeriodDays(loadedConfig.periodDays || {});
    setHolidays(loadedConfig.holidays || {});
    setLateFlags(loadedConfig.lateFlags || {});
    setMarks(loadedMarks);
  }, [context]);

  function persistStudents(nextStudents) {
    setStudents(nextStudents);
    writeJson(getAttendanceKey('students', context), nextStudents);
  }

  function persistConfig(nextPeriodDays, nextHolidays, nextLateFlags = lateFlags) {
    setPeriodDays(nextPeriodDays);
    setHolidays(nextHolidays);
    setLateFlags(nextLateFlags);
    writeJson(getAttendanceKey('config', context), {
      periodDays: nextPeriodDays,
      holidays: nextHolidays,
      lateFlags: nextLateFlags,
    });
  }

  function persistMarks(nextMarks) {
    setMarks(nextMarks);
    writeJson(getAttendanceKey('marks', context), nextMarks);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setSelectedCalendarDay(dayNumber) {
    setSelectedDate(`${form.month}-${String(dayNumber).padStart(2, '0')}`);
  }

  function handlePlannerDayCycle(dayNumber) {
    const nextConfig = cycleDayStatus(dayNumber, form.month, periodDays, holidays);
    persistConfig(nextConfig.periodDays, nextConfig.holidays);
  }

  function ensureSelectedDayIsTracked(nextLateFlags = lateFlags) {
    const nextPeriodDays = { ...periodDays, [selectedDay]: true };
    const nextHolidays = { ...holidays };
    delete nextHolidays[selectedDay];
    persistConfig(nextPeriodDays, nextHolidays, nextLateFlags);
  }

  function setStudentStatus(studentId, status) {
    const nextMarks = { ...marks };
    const nextLateFlags = { ...lateFlags };

    nextMarks[studentId] = {
      ...nextMarks[studentId],
      [selectedDay]: status === 'A' ? 'A' : status ? 'P' : '',
    };

    nextLateFlags[studentId] = {
      ...nextLateFlags[studentId],
      [selectedDay]: status === 'L',
    };

    if (!status) delete nextLateFlags[studentId]?.[selectedDay];

    ensureSelectedDayIsTracked(nextLateFlags);
    persistMarks(nextMarks);
  }

  function handleQuickMark(status) {
    const nextMarks = { ...marks };
    const nextLateFlags = { ...lateFlags };
    students.forEach((student) => {
      nextMarks[student.id] = {
        ...nextMarks[student.id],
        [selectedDay]: status === 'A' ? 'A' : 'P',
      };
      nextLateFlags[student.id] = {
        ...nextLateFlags[student.id],
        [selectedDay]: false,
      };
    });

    ensureSelectedDayIsTracked(nextLateFlags);
    persistMarks(nextMarks);
  }

  function handleAddStudent() {
    const name = newStudent.name.trim();
    if (!name) return;

    const nextStudents = [
      ...students,
      {
        id: createId(),
        rollNo: newStudent.rollNo.trim() || String(students.length + 1),
        name,
      },
    ];

    persistStudents(nextStudents);
    setNewStudent({ rollNo: '', name: '' });
    setIsAddModalOpen(false);
  }

  function handleBulkImport() {
    if (!bulkText.trim()) return;
    const importedStudents = parseStudentLines(bulkText, replaceStudents ? 1 : students.length + 1);
    const nextStudents = replaceStudents ? importedStudents : [...students, ...importedStudents];
    persistStudents(nextStudents);

    if (replaceStudents) {
      persistMarks({});
      persistConfig(periodDays, holidays, {});
    }

    setBulkText('');
    setReplaceStudents(false);
    setIsBulkModalOpen(false);
  }

  function handleExport() {
    const rows = buildAttendanceExportRows({
      students,
      monthKey: form.month,
      subject: form.subject.trim(),
      classValue: form.classValue,
      section: context.section,
      academicYear,
      periodDays,
      holidays,
      marks,
    });
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    XLSX.writeFile(workbook, `Attendance_Class${form.classValue}${context.section}_${MONTH_NAMES[monthMeta.monthIndex]}${monthMeta.year}_${academicYear}.xlsx`);
  }

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => `${student.name} ${student.rollNo}`.toLowerCase().includes(query));
  }, [searchQuery, students]);

  const rosterRows = useMemo(
    () => filteredStudents.map((student) => {
      const attendance = calculateAttendanceRow(student.id, daysInMonth, form.month, periodDays, holidays, marks);
      const mark = marks[student.id]?.[selectedDay] || '';
      const isLate = Boolean(lateFlags[student.id]?.[selectedDay]);
      const status = isLate ? 'L' : mark || '';
      return {
        student,
        attendance,
        status,
        remark: status === 'L' ? 'Late arrival' : status === 'A' ? 'Absent' : 'No remarks',
      };
    }),
    [daysInMonth, filteredStudents, form.month, holidays, lateFlags, marks, periodDays, selectedDay],
  );

  const totalPages = Math.max(1, Math.ceil(rosterRows.length / pageSize));
  const paginatedRosterRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return rosterRows.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, rosterRows]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const firstVisibleRow = rosterRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisibleRow = Math.min(currentPage * pageSize, rosterRows.length);

  const presentCount = rosterRows.filter((row) => row.status === 'P').length;
  const absentCount = rosterRows.filter((row) => row.status === 'A').length;
  const lateCount = rosterRows.filter((row) => row.status === 'L').length;
  const averageAttendance = rosterRows.length
    ? Math.round(rosterRows.reduce((sum, row) => sum + row.attendance.percentage, 0) / rosterRows.length)
    : 0;
  const plannerCounts = useMemo(
    () => Array.from({ length: daysInMonth }, (_, index) => index + 1).reduce(
      (summary, dayNumber) => {
        const status = getDayStatus(dayNumber, form.month, periodDays, holidays);
        if (status === 'period') summary.period += 1;
        if (status === 'holiday') summary.holiday += 1;
        if (status === 'sunday') summary.sunday += 1;
        return summary;
      },
      { period: 0, holiday: 0, sunday: 0 },
    ),
    [daysInMonth, form.month, holidays, periodDays],
  );
  const plannerCells = useMemo(() => {
    const leadingEmptyCells = getDayOfWeek(form.month, 1);
    const emptyCells = Array.from({ length: leadingEmptyCells }, (_, index) => ({ key: `empty-${index}`, isEmpty: true }));
    const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      return {
        key: `day-${dayNumber}`,
        dayNumber,
        dayLabel: DAY_ABBREVIATIONS[getDayOfWeek(form.month, dayNumber)],
        status: getDayStatus(dayNumber, form.month, periodDays, holidays),
        isSelected: selectedDay === dayNumber,
      };
    });
    return [...emptyCells, ...dayCells];
  }, [daysInMonth, form.month, holidays, periodDays, selectedDay]);
  const plannerWeeks = useMemo(
    () => Array.from({ length: Math.ceil(plannerCells.length / 7) }, (_, index) => plannerCells.slice(index * 7, index * 7 + 7)),
    [plannerCells],
  );

  return (
    <StitchDesktopShell
      activeNav="attendance"
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search student records..."
      academicYear={academicYear}
      onAcademicYearChange={onAcademicYearChange}
      academicYearOptions={academicYearOptions}
      onNewEntry={() => setIsAddModalOpen(true)}
      newEntryLabel="Add Student"
      onLogout={onLogout}
      profileName={currentUser}
      profileRole="Signed In User"
    >
      <main className="stitch-content-canvas">
        <section className="stitch-attendance-header">
          <div className="stitch-page-heading-copy">
            <h1>Daily Attendance</h1>
            <p className="stitch-page-subtitle">Track class attendance, mark status, and review daily engagement for Academic Year {academicYear}.</p>
            <div className="stitch-attendance-controls">
              <div className="stitch-attendance-chip">
                <span className="material-symbols-outlined">grid_view</span>
                <select value={form.classValue} onChange={(event) => updateForm('classValue', event.target.value)}>
                  {CLASS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      Class {option}
                    </option>
                  ))}
                </select>
                <input value={form.section} maxLength={2} onChange={(event) => updateForm('section', event.target.value)} aria-label="Section" />
              </div>
              <div className="stitch-attendance-chip">
                <span className="material-symbols-outlined">calendar_today</span>
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </div>
            </div>
          </div>
          <div className="stitch-attendance-actions">
            <button type="button" onClick={handleExport}>
              <span className="material-symbols-outlined">file_download</span>
              <span>Export List</span>
            </button>
            <button type="button" className="stitch-primary-gradient-btn" onClick={() => window.alert('Attendance is saved automatically in browser storage.') }>
              <span className="material-symbols-outlined">save</span>
              <span>Save Attendance</span>
            </button>
          </div>
        </section>

        <section className="stitch-attendance-stats">
          <article className="stitch-attendance-stat-card">
            <div className="stitch-stat-icon stitch-stat-icon--green"><span className="material-symbols-outlined">how_to_reg</span></div>
            <div><p>Present Today</p><h3>{presentCount} <span>/ {rosterRows.length}</span></h3></div>
          </article>
          <article className="stitch-attendance-stat-card">
            <div className="stitch-stat-icon stitch-stat-icon--red"><span className="material-symbols-outlined">person_off</span></div>
            <div><p>Absentees</p><h3>{absentCount}</h3></div>
          </article>
          <article className="stitch-attendance-stat-card">
            <div className="stitch-stat-icon stitch-stat-icon--amber"><span className="material-symbols-outlined">schedule</span></div>
            <div><p>Late Arrivals</p><h3>{lateCount}</h3></div>
          </article>
          <article className="stitch-attendance-stat-card">
            <div className="stitch-stat-icon stitch-stat-icon--blue"><span className="material-symbols-outlined">analytics</span></div>
            <div><p>Avg. Attendance</p><h3>{averageAttendance}%</h3></div>
          </article>
        </section>

        <section className="stitch-attendance-planner-shell">
          <div className="stitch-attendance-planner-head">
            <div>
              <h2>Monthly Period Planner</h2>
              <p>Select a date to work on. Use the status chip to cycle each day through Working, Period, and GH.</p>
            </div>
            <div className="stitch-attendance-planner-meta">
              <span><strong>{plannerCounts.period}</strong> Period Days</span>
              <span><strong>{plannerCounts.holiday}</strong> GH</span>
              <span><strong>{plannerCounts.sunday}</strong> Sundays</span>
            </div>
          </div>

          <div className="stitch-calendar-weekdays d-none d-lg-grid">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="stitch-calendar-grid stitch-attendance-planner-grid d-none d-lg-grid">
            {plannerCells.map((cell) => {
              if (cell.isEmpty) {
                return <div key={cell.key} className="stitch-calendar-day is-empty" aria-hidden="true" />;
              }

              return (
                <div
                  key={cell.key}
                  className={`stitch-calendar-day stitch-attendance-planner-day is-${cell.status} ${cell.isSelected ? 'is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="stitch-attendance-planner-date"
                    onClick={() => setSelectedCalendarDay(cell.dayNumber)}
                    aria-pressed={cell.isSelected}
                  >
                    <small>{MONTH_NAMES[monthMeta.monthIndex].slice(0, 3)}</small>
                    <strong>{cell.dayNumber}</strong>
                  </button>
                  <button
                    type="button"
                    className={`stitch-attendance-planner-status is-${cell.status}`}
                    onClick={() => handlePlannerDayCycle(cell.dayNumber)}
                    disabled={cell.status === 'sunday'}
                    aria-label={`Change status for ${MONTH_NAMES[monthMeta.monthIndex]} ${cell.dayNumber}`}
                  >
                    {getPlannerStatusLabel(cell.status)}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="stitch-attendance-planner-mobile d-lg-none">
            {plannerWeeks.map((week, index) => (
              <div key={`week-${index + 1}`} className="stitch-attendance-planner-week">
                <div className="stitch-attendance-planner-week-head">
                  <span>Week {index + 1}</span>
                  <small>Swipe sideways to review the full week</small>
                </div>
                <div className="stitch-attendance-planner-strip">
                  {week.map((cell) => {
                    if (cell.isEmpty) {
                      return <div key={cell.key} className="stitch-attendance-planner-mobile-empty" aria-hidden="true" />;
                    }

                    return (
                      <div
                        key={cell.key}
                        className={`stitch-calendar-day stitch-attendance-planner-day stitch-attendance-planner-day--mobile is-${cell.status} ${cell.isSelected ? 'is-selected' : ''}`}
                      >
                        <button
                          type="button"
                          className="stitch-attendance-planner-date"
                          onClick={() => setSelectedCalendarDay(cell.dayNumber)}
                          aria-pressed={cell.isSelected}
                        >
                          <small>{cell.dayLabel}</small>
                          <strong>{cell.dayNumber}</strong>
                        </button>
                        <button
                          type="button"
                          className={`stitch-attendance-planner-status is-${cell.status}`}
                          onClick={() => handlePlannerDayCycle(cell.dayNumber)}
                          disabled={cell.status === 'sunday'}
                          aria-label={`Change status for ${MONTH_NAMES[monthMeta.monthIndex]} ${cell.dayNumber}`}
                        >
                          {getPlannerStatusLabel(cell.status)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="stitch-attendance-mobile-list d-lg-none">
          <h2>Student Roster</h2>
          {rosterRows.length === 0 ? (
            <article className="stitch-attendance-mobile-card">
              <p>No students found for this class.</p>
            </article>
          ) : (
            paginatedRosterRows.map((row) => (
              <article key={row.student.id} className="stitch-attendance-mobile-card">
                <div className="stitch-attendance-mobile-head">
                  <div className="stitch-directory-avatar">{getInitials(row.student.name)}</div>
                  <div>
                    <h3>{row.student.name}</h3>
                    <p>Roll No: {String(row.student.rollNo).padStart(2, '0')}</p>
                  </div>
                </div>

                <div className="stitch-attendance-mobile-foot">
                  <div className="stitch-status-toggle">
                    <button type="button" className={row.status === 'P' ? 'is-present' : ''} onClick={() => setStudentStatus(row.student.id, 'P')}>P</button>
                    <button type="button" className={row.status === 'A' ? 'is-absent' : ''} onClick={() => setStudentStatus(row.student.id, 'A')}>A</button>
                    <button type="button" className={row.status === 'L' ? 'is-late' : ''} onClick={() => setStudentStatus(row.student.id, 'L')}>L</button>
                  </div>
                  <small>{row.attendance.percentage}% attendance</small>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="stitch-attendance-roster-shell">
          <div className="stitch-attendance-roster-head">
            <h2>Student Roster</h2>
            <div>
              <span className='mr-1'>Quick Mark All:</span>
              <div className="stitch-quick-toggle">
                <button type="button" className="is-active" onClick={() => handleQuickMark('P')}>Present</button>
                <button type="button" onClick={() => handleQuickMark('A')}>Absent</button>
              </div>
            </div>
          </div>

          <div className="stitch-attendance-table-wrap">
            <table className="stitch-attendance-table">
              <thead>
                <tr>
                  <th>Roll No.</th>
                  <th>Student Identity</th>
                  <th>Performance</th>
                  <th>Status Toggle</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {rosterRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="stitch-empty-row">No students found for this class.</td>
                  </tr>
                ) : (
                  paginatedRosterRows.map((row) => (
                    <tr key={row.student.id}>
                      <td>#{String(row.student.rollNo).padStart(3, '0')}</td>
                      <td>
                        <div className="stitch-attendance-student-cell">
                          <div className="stitch-directory-avatar">{getInitials(row.student.name)}</div>
                          <div>
                            <p>{row.student.name}</p>
                            <small>{row.student.name.toLowerCase().replace(/\s+/g, '.')}@scholar.edu</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="stitch-attendance-performance">
                          <div className="stitch-directory-bar"><span style={{ width: `${row.attendance.percentage}%` }} /></div>
                          <small>{row.attendance.percentage}% Attendance rate</small>
                        </div>
                      </td>
                      <td>
                        <div className="stitch-status-toggle">
                          <button type="button" className={row.status === 'P' ? 'is-present' : ''} onClick={() => setStudentStatus(row.student.id, 'P')}>P</button>
                          <button type="button" className={row.status === 'A' ? 'is-absent' : ''} onClick={() => setStudentStatus(row.student.id, 'A')}>A</button>
                          <button type="button" className={row.status === 'L' ? 'is-late' : ''} onClick={() => setStudentStatus(row.student.id, 'L')}>L</button>
                        </div>
                      </td>
                      <td>
                        <span className={`stitch-attendance-remark ${row.status === 'A' ? 'is-danger' : row.status === 'L' ? 'is-warn' : ''}`}>{row.remark}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="stitch-attendance-footer">
            <p>
              Showing {firstVisibleRow}-{lastVisibleRow} of {rosterRows.length} students in Class {form.classValue}
              {context.section}
            </p>
            <div className="d-flex align-items-center gap-2">
              <select
                className="form-select form-select-sm"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                aria-label="Rows per page"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
              </select>
              {totalPages > 1 ? (
                <div className="stitch-grid-pages">
                  <button type="button" aria-label="Previous page" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button key={page} type="button" className={page === currentPage ? 'is-active' : ''} onClick={() => setCurrentPage(page)}>
                      {page}
                    </button>
                  ))}
                  <button type="button" aria-label="Next page" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <Modal title="Add Student" isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <div className="mb-3">
          <label className="form-label">Roll No</label>
          <input className="form-control" type="number" min="1" value={newStudent.rollNo} onChange={(event) => setNewStudent((current) => ({ ...current, rollNo: event.target.value }))} />
        </div>
        <div className="mb-3">
          <label className="form-label">Student Name</label>
          <input className="form-control" value={newStudent.name} onChange={(event) => setNewStudent((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => event.key === 'Enter' && handleAddStudent()} />
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleAddStudent}>Add Student</button>
        </div>
      </Modal>

      <Modal title="Bulk Import Students" isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} size="modal-dialog modal-lg">
        <p className="text-muted small mb-2">One student per line. Use RollNo, Name or just Name.</p>
        <textarea className="form-control font-monospace" rows={10} value={bulkText} onChange={(event) => setBulkText(event.target.value)} />
        <div className="form-check mt-3">
          <input className="form-check-input" type="checkbox" id="replaceCheckAttendance" checked={replaceStudents} onChange={(event) => setReplaceStudents(event.target.checked)} />
          <label className="form-check-label text-danger" htmlFor="replaceCheckAttendance">Replace existing student list for this class and clear saved attendance marks</label>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-secondary" onClick={() => setIsBulkModalOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleBulkImport}>Import Students</button>
        </div>
      </Modal>
    </StitchDesktopShell>
  );
}