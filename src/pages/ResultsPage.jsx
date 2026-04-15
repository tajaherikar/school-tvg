import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import StitchMobileChrome from '../components/StitchMobileChrome';
import TopBarUtilityActions from '../components/TopBarUtilityActions';
import { CLASS_OPTIONS } from '../lib/constants';
import { createId, parseStudentLines, readJson, writeJson } from '../lib/storage';
import { getResultsContext, getResultsKey } from '../features/results/storage';
import { buildResultsExportRows, getResultsSummary, getStudentResult } from '../features/results/utils';

const defaultForm = {
  classValue: '6',
  section: 'A',
  subject: '',
  exam: 'SA1',
};

const fieldSpecs = [
  { field: 'fa1', max: 20 },
  { field: 'fa2', max: 20 },
  { field: 'sa1', max: 40 },
  { field: 'oral', max: 10 },
];
const desktopFieldOrder = ['fa1', 'fa2', 'sa1', 'oral'];

function getFieldLabel(field, exam) {
  if (field === 'sa1') return exam;
  return field.toUpperCase();
}

function getFieldConversionLabel(field, exam) {
  if (field === 'fa1') return 'FA1 (20 -> 10)';
  if (field === 'fa2') return 'FA2 (20 -> 10)';
  if (field === 'sa1') return `${exam} (40 -> 20)`;
  return 'Oral (10 -> 10)';
}

function getInitials(name) {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'NA';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
}

function formatMark(value) {
  if (value === '' || value == null) return '-';
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return '-';
  return parsed.toFixed(1);
}

export default function ResultsPage({ currentUser, onLogout, searchQuery, onSearchChange, academicYear, onAcademicYearChange, academicYearOptions }) {
  const [form, setForm] = useState(defaultForm);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ rollNo: '', name: '' });
  const [bulkText, setBulkText] = useState('');
  const [replaceStudents, setReplaceStudents] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const desktopInputRefs = useRef({});

  const context = useMemo(() => getResultsContext(form), [form]);
  const examLabel = form.exam === 'SA1' ? 'SA-I' : 'SA-II';
  const examComponentLabel = form.exam;

  useEffect(() => {
    setStudents(readJson(getResultsKey('students', context), []));
    setMarks(readJson(getResultsKey('marks', context), {}));
  }, [context]);

  function persistStudents(nextStudents) {
    setStudents(nextStudents);
    writeJson(getResultsKey('students', context), nextStudents);
  }

  function persistMarks(nextMarks) {
    setMarks(nextMarks);
    writeJson(getResultsKey('marks', context), nextMarks);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
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
    if (replaceStudents) persistMarks({});

    setBulkText('');
    setReplaceStudents(false);
    setIsBulkModalOpen(false);
  }

  function handleImportFromAttendance() {
    const attendanceStudents = readJson(getResultsKey('attendanceStudents', context), []);
    if (attendanceStudents.length === 0) {
      window.alert(`No students found in Attendance for Class ${form.classValue} Section ${context.section}.`);
      return;
    }

    const existingNames = new Set(students.map((student) => student.name.toLowerCase()));
    const imported = attendanceStudents
      .filter((student) => !existingNames.has(student.name.toLowerCase()))
      .map((student) => ({ id: createId(), rollNo: student.rollNo, name: student.name }));

    if (imported.length === 0) {
      window.alert('All attendance students are already present in the results list.');
      return;
    }

    persistStudents([...students, ...imported]);
    window.alert(`${imported.length} student(s) imported from Attendance.`);
  }

  function handleMarkChange(studentId, field, value, max, inputElement) {
    if (value !== '') {
      const parsed = Number.parseFloat(value);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > max) {
        inputElement.setCustomValidity(`Enter a value between 0 and ${max}.`);
        inputElement.reportValidity();
        return;
      }
    }

    inputElement.setCustomValidity('');
    const nextMarks = {
      ...marks,
      [studentId]: {
        ...marks[studentId],
        [field]: value,
      },
    };
    persistMarks(nextMarks);
  }

  function handleExport() {
    const rows = buildResultsExportRows({
      students,
      marks,
      examLabel,
      examComponentLabel,
      classValue: form.classValue,
      section: context.section,
      subject: form.subject.trim(),
      academicYear,
    });
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    XLSX.writeFile(workbook, `Results_${examLabel.replace('-', '')}_Class${form.classValue}${context.section}_${academicYear}.xlsx`);
  }

  function handlePublish() {
    window.print();
  }

  const summary = useMemo(() => getResultsSummary(students, marks), [students, marks]);
  const averagePercent = summary.count > 0 ? ((Number(summary.average) / 50) * 100).toFixed(1) : '0.0';
  const passRate = summary.count > 0 ? summary.passPercentage : '0.0';
  const visibleStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const name = student.name.toLowerCase();
      const rollNo = String(student.rollNo).toLowerCase();
      return name.includes(query) || rollNo.includes(query);
    });
  }, [searchQuery, students]);

  const totalPages = Math.max(1, Math.ceil(visibleStudents.length / pageSize));
  const paginatedVisibleStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return visibleStudents.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, visibleStudents]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const firstVisibleRow = visibleStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisibleRow = Math.min(currentPage * pageSize, visibleStudents.length);

  function focusDesktopCell(rowIndex, fieldIndex) {
    if (fieldIndex < 0 || fieldIndex >= desktopFieldOrder.length) return;
    if (rowIndex < 0 || rowIndex >= paginatedVisibleStudents.length) return;

    const key = `${rowIndex}-${desktopFieldOrder[fieldIndex]}`;
    const input = desktopInputRefs.current[key];
    if (input) {
      input.focus();
      input.select();
    }
  }

  function handleDesktopGridKeyDown(event, rowIndex, fieldIndex) {
    const key = event.key;
    if (!['Enter', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(key)) return;

    event.preventDefault();

    if (key === 'Enter' || key === 'ArrowDown') {
      focusDesktopCell(rowIndex + 1, fieldIndex);
      return;
    }

    if (key === 'ArrowUp') {
      focusDesktopCell(rowIndex - 1, fieldIndex);
      return;
    }

    if (key === 'ArrowRight') {
      focusDesktopCell(rowIndex, fieldIndex + 1);
      return;
    }

    focusDesktopCell(rowIndex, fieldIndex - 1);
  }

  return (
    <div className="tool-shell tool-shell--stitch-exact">
      <StitchMobileChrome
        activeNav="results"
        academicYear={academicYear}
        onAcademicYearChange={onAcademicYearChange}
        academicYearOptions={academicYearOptions}
        onNewEntry={() => setIsAddModalOpen(true)}
        newEntryLabel="Add Student"
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
          <Link to="/" className="stitch-side-link">
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </Link>
          <Link to="/attendance" className="stitch-side-link">
            <span className="material-symbols-outlined">event_available</span>
            <span>Attendance</span>
          </Link>
          <Link to="/results" className="stitch-side-link stitch-side-link--active">
            <span className="material-symbols-outlined">assignment</span>
            <span>Exams</span>
          </Link>
          <Link to="/students" className="stitch-side-link">
            <span className="material-symbols-outlined">group</span>
            <span>Students</span>
          </Link>
          <Link to="/reports" className="stitch-side-link">
            <span className="material-symbols-outlined">assessment</span>
            <span>Reports</span>
          </Link>
        </nav>

        <div className="stitch-side-cta-wrap">
          <button type="button" className="stitch-side-cta" onClick={() => setIsAddModalOpen(true)}>
            <span className="material-symbols-outlined">add</span>
            <span>Add Student</span>
          </button>
        </div>
      </aside>

      <header className="stitch-top-nav">
        <div className="stitch-search-wrap">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search student results..."
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
              <p>{currentUser}</p>
              <small>Signed In User</small>
            </div>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBu6EM6H0wRGvdXOmEJIe2bUeFZFn-zLW1m2S7ugkKDu43l2JYkLpY7_hK9RpMyuHtDqwvKWnmuHxqquN-MhLAYdNvHeJJffxLrOL1-0X2V_9FoYrMIk9mui8-2ll8GPDORuzv5nyqyytd5lq9RB9f3EgpiJ7OEtXt-yHM68eANJ1tWq-xwPgFNhL9s40_M-VtVyJJBg9J1NhpvIw2Mxaea1zz-HOUHz6CkXNs77SgSDvb-FgoVeBhAU2RzyfiSFuzhUORS3ZxcxAA"
              alt="Teacher"
            />
          </div>
        </div>
      </header>

      <main className="stitch-content-canvas">
        <section className="stitch-title-row">
          <div className="stitch-page-heading-copy">
            <h1>Student Performance</h1>
            <p className="stitch-page-subtitle">Viewing performance analytics and component scores for Grade {form.classValue}-{context.section} in Academic Year {academicYear}.</p>
          </div>
          <div className="stitch-filters-row">
            <div className="stitch-control">
              <label>Class</label>
              <select value={form.classValue} onChange={(event) => updateForm('classValue', event.target.value)}>
                {CLASS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="stitch-control">
              <label>Section</label>
              <input value={form.section} maxLength={2} onChange={(event) => updateForm('section', event.target.value)} />
            </div>
            <div className="stitch-control">
              <label>Subject</label>
              <input value={form.subject} placeholder="Mathematics" onChange={(event) => updateForm('subject', event.target.value)} />
            </div>
            <div className="stitch-control">
              <label>Assessment</label>
              <select value={form.exam} onChange={(event) => updateForm('exam', event.target.value)}>
                <option value="SA1">Term 1</option>
                <option value="SA2">Final Exam</option>
              </select>
            </div>
            <div className="stitch-control-actions">
              <button type="button" title="Bulk Import" onClick={() => setIsBulkModalOpen(true)}>
                <span className="material-symbols-outlined">playlist_add</span>
              </button>
              <button type="button" title="Import Attendance" onClick={handleImportFromAttendance}>
                <span className="material-symbols-outlined">group_add</span>
              </button>
              <button type="button" title="Export Excel" onClick={handleExport}>
                <span className="material-symbols-outlined">download</span>
              </button>
            </div>
          </div>
        </section>

        <section className="stitch-inline-guide stitch-inline-guide--results">
          <div>
            <strong>Add marks directly in the score cells below.</strong>
            <p>Use the Class, Section, Subject, and Assessment filters first. Conversion used here: FA1 20 to 10, FA2 20 to 10, {examComponentLabel} 40 to 20, Oral 10 to 10. Final total is out of 50.</p>
          </div>
        </section>

        <section className="stitch-kpi-grid">
          <article className="stitch-kpi-card">
            <div className="stitch-kpi-icon">
              <span className="material-symbols-outlined">groups</span>
            </div>
            <p>Total Students</p>
            <h3>{students.length}</h3>
          </article>
          <article className="stitch-kpi-card">
            <div className="stitch-kpi-icon stitch-kpi-icon--green">
              <span className="material-symbols-outlined">star</span>
            </div>
            <p>Class Average</p>
            <h3 className="stitch-kpi-value-green">{averagePercent}%</h3>
          </article>
          <article className="stitch-kpi-card">
            <div className="stitch-kpi-icon stitch-kpi-icon--amber">
              <span className="material-symbols-outlined">verified</span>
            </div>
            <p>Pass Percentage</p>
            <h3>{passRate}%</h3>
          </article>
          <article className="stitch-kpi-card">
            <div className="stitch-kpi-icon stitch-kpi-icon--red">
              <span className="material-symbols-outlined">warning</span>
            </div>
            <p>Needs Attention</p>
            <h3 className="stitch-kpi-value-red">{summary.fail}</h3>
          </article>
        </section>

        <section className="stitch-results-mobile-summary d-lg-none">
          <div>
            <p>Passing</p>
            <h3>
              {summary.pass} <span>Students</span>
            </h3>
          </div>
          <div>
            <p>Failing</p>
            <h3>
              {summary.fail} <span>Students</span>
            </h3>
          </div>
        </section>

        <section className="stitch-results-mobile-list d-lg-none">
          {visibleStudents.length === 0 ? (
            <article className="stitch-results-mobile-card">
              <p>No students match this view.</p>
              <small>Add/import students to continue.</small>
            </article>
          ) : (
            paginatedVisibleStudents.map((student) => {
              const markRow = marks[student.id] || {};
              const result = getStudentResult(markRow);
              const isFail = result ? !result.gradeInfo.pass : false;
              const total50 = result ? result.converted.total : '-';
              return (
                <article key={student.id} className={`stitch-results-mobile-card ${isFail ? 'is-fail' : ''}`}>
                  <div className="stitch-results-mobile-head">
                    <div>
                      <h3>{student.name}</h3>
                      <p>Roll No: {student.rollNo}</p>
                    </div>
                    <span className={`stitch-grade-chip ${isFail ? 'stitch-grade-chip--fail' : 'stitch-grade-chip--pass'}`}>
                      {result ? result.gradeInfo.grade : '-'}
                    </span>
                  </div>

                  <div className="stitch-results-mobile-grid">
                    {fieldSpecs.map((spec) => (
                      <label key={spec.field}>
                        <small>{getFieldConversionLabel(spec.field, examComponentLabel)}</small>
                        <input
                          type="number"
                          min="0"
                          max={spec.max}
                          step="0.5"
                          value={markRow[spec.field] ?? ''}
                          onChange={(event) => handleMarkChange(student.id, spec.field, event.target.value, spec.max, event.target)}
                          aria-label={`${getFieldLabel(spec.field, examComponentLabel)} for ${student.name}`}
                        />
                      </label>
                    ))}
                    <div className="stitch-results-mobile-total">
                      <small>Total /50</small>
                      <strong>{total50}</strong>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <section className="stitch-grid-shell">
          <div className="stitch-grid-scroll">
            <table className="stitch-grid-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>FA1 (20 -&gt; 10)</th>
                  <th>FA2 (20 -&gt; 10)</th>
                  <th>{examComponentLabel} (40 -&gt; 20)</th>
                  <th>Oral (10 -&gt; 10)</th>
                  <th>Total (50)</th>
                  <th>Grade</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="stitch-empty-row">
                      No students match this view. Add/import students to continue.
                    </td>
                  </tr>
                ) : (
                  paginatedVisibleStudents.map((student, rowIndex) => {
                    const markRow = marks[student.id] || {};
                    const result = getStudentResult(markRow);
                    const fa1 = formatMark(markRow.fa1);
                    const oral = formatMark(markRow.oral);
                    const total50 = result ? result.converted.total : '-';
                    const trendPercent = result ? Math.max(4, Math.min(100, Math.round((result.total / 50) * 100))) : 0;
                    const isFail = result ? !result.gradeInfo.pass : false;

                    return (
                      <tr key={student.id} className={isFail ? 'stitch-row-warning' : ''}>
                        <td>
                          <div className="stitch-student-id-cell">
                            <div className={`stitch-student-dot ${isFail ? 'stitch-student-dot--warn' : ''}`}>{getInitials(student.name)}</div>
                            <div>
                              <p>{student.name}</p>
                              <small>ID: SCH-{String(student.rollNo).padStart(4, '0')}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            value={markRow.fa1 ?? ''}
                            onChange={(event) => handleMarkChange(student.id, 'fa1', event.target.value, 20, event.target)}
                            onKeyDown={(event) => handleDesktopGridKeyDown(event, rowIndex, 0)}
                            ref={(element) => {
                              desktopInputRefs.current[`${rowIndex}-fa1`] = element;
                            }}
                            className={`stitch-cell-input ${isFail && fa1 !== '-' ? 'stitch-cell-input--danger' : ''}`}
                            aria-label={`FA1 for ${student.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            value={markRow.fa2 ?? ''}
                            onChange={(event) => handleMarkChange(student.id, 'fa2', event.target.value, 20, event.target)}
                            onKeyDown={(event) => handleDesktopGridKeyDown(event, rowIndex, 1)}
                            ref={(element) => {
                              desktopInputRefs.current[`${rowIndex}-fa2`] = element;
                            }}
                            className="stitch-cell-input"
                            aria-label={`FA2 for ${student.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={markRow.sa1 ?? ''}
                            onChange={(event) => handleMarkChange(student.id, 'sa1', event.target.value, 40, event.target)}
                            onKeyDown={(event) => handleDesktopGridKeyDown(event, rowIndex, 2)}
                            ref={(element) => {
                              desktopInputRefs.current[`${rowIndex}-sa1`] = element;
                            }}
                            className="stitch-cell-input"
                            aria-label={`${examComponentLabel} for ${student.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            value={markRow.oral ?? ''}
                            onChange={(event) => handleMarkChange(student.id, 'oral', event.target.value, 10, event.target)}
                            onKeyDown={(event) => handleDesktopGridKeyDown(event, rowIndex, 3)}
                            ref={(element) => {
                              desktopInputRefs.current[`${rowIndex}-oral`] = element;
                            }}
                            className={`stitch-cell-input ${isFail && oral !== '-' ? 'stitch-cell-input--danger' : ''}`}
                            aria-label={`Oral for ${student.name}`}
                          />
                        </td>
                        <td>
                          <span className={`stitch-total-pill ${isFail ? 'stitch-total-pill--danger' : ''}`}>{total50}</span>
                        </td>
                        <td>
                          <span className={`stitch-grade-chip ${isFail ? 'stitch-grade-chip--fail' : 'stitch-grade-chip--pass'}`}>
                            {result ? result.gradeInfo.grade : '-'}
                          </span>
                        </td>
                        <td>
                          <div className="stitch-trend-rail">
                            <div className={`stitch-trend-progress ${isFail ? 'stitch-trend-progress--fail' : ''}`} style={{ width: `${trendPercent}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="stitch-grid-footer">
            <span>Showing {firstVisibleRow}-{lastVisibleRow} of {visibleStudents.length} students</span>
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

      <footer className="stitch-sticky-bar">
        <div className="stitch-sticky-left">
          <div>
            <p>Passing Rate</p>
            <h4>
              {summary.pass} / {students.length} <span>Students</span>
            </h4>
          </div>
          <div>
            <p>Fail/At Risk</p>
            <h4 className="stitch-red-text">
              {summary.fail.toString().padStart(2, '0')} / {students.length} <span>Students</span>
            </h4>
          </div>
          <div className="stitch-sticky-avatars d-none d-xl-flex">
            {students.slice(0, 2).map((student) => (
              <span key={student.id}>{getInitials(student.name)}</span>
            ))}
            {students.length > 2 ? <span className="stitch-sticky-plus">+{students.length - 2}</span> : null}
            <small>Results ready for review</small>
          </div>
        </div>

        <div className="stitch-sticky-actions">
          <button type="button" onClick={() => window.alert('Draft saved locally via browser storage.')}>Save Draft</button>
          <button type="button" className="stitch-primary-action" onClick={handlePublish}>
            <span className="material-symbols-outlined">cloud_upload</span>
            <span>Publish Results</span>
          </button>
        </div>
      </footer>

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
          <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleAddStudent}>
            Add Student
          </button>
        </div>
      </Modal>

      <Modal title="Bulk Import Students" isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} size="modal-dialog modal-lg">
        <p className="text-muted small mb-2">One student per line. Use RollNo, Name or just Name.</p>
        <textarea className="form-control font-monospace" rows={10} value={bulkText} onChange={(event) => setBulkText(event.target.value)} />
        <div className="form-check mt-3">
          <input className="form-check-input" type="checkbox" id="replaceCheckResults" checked={replaceStudents} onChange={(event) => setReplaceStudents(event.target.checked)} />
          <label className="form-check-label text-danger" htmlFor="replaceCheckResults">
            Replace existing student list and clear saved marks for this class and exam
          </label>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-secondary" onClick={() => setIsBulkModalOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleBulkImport}>
            Import Students
          </button>
        </div>
      </Modal>
    </div>
  );
}
