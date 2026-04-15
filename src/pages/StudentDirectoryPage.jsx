import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import StitchDesktopShell from '../components/StitchDesktopShell';
import { getUnifiedStudentDirectory } from '../lib/insights';
import { createId, normalizeSection, parseStudentLines, readJson, writeJson } from '../lib/storage';
import { getResultsContext, getResultsKey } from '../features/results/storage';
import { getAttendanceKey } from '../features/attendance/storage';

function getInitials(name) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getGpaLabel(percent) {
  if (percent == null) return { label: 'No exam data', tone: 'neutral', value: '-' };
  if (percent >= 90) return { label: 'Excellence', tone: 'good', value: '4.0' };
  if (percent >= 75) return { label: 'Good', tone: 'good', value: '3.5' };
  if (percent >= 60) return { label: 'Stable', tone: 'neutral', value: '3.0' };
  return { label: 'Risk', tone: 'danger', value: '2.0' };
}

export default function StudentDirectoryPage({ currentUser, onLogout, searchQuery, onSearchChange, academicYear, onAcademicYearChange, academicYearOptions }) {
  const [students, setStudents] = useState(() => getUnifiedStudentDirectory());
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentForm, setEditStudentForm] = useState({ classValue: '6', section: 'A', rollNo: '', name: '' });
  const [newStudentForm, setNewStudentForm] = useState({ classValue: '6', section: 'A', rollNo: '', name: '' });
  const [bulkStudentText, setBulkStudentText] = useState('');
  const [replaceClassStudents, setReplaceClassStudents] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  function reloadStudents() {
    setStudents(getUnifiedStudentDirectory());
  }

  function updateNewStudent(field, value) {
    setNewStudentForm((current) => ({ ...current, [field]: value }));
  }

  function syncStudentsToClassStores(classValue, sectionValue, incomingStudents, shouldReplace = false) {
    const section = normalizeSection(sectionValue);

    const attendanceContext = {
      classValue,
      section,
    };
    const attendanceStudentsKey = getAttendanceKey('students', attendanceContext);
    const attendanceStudents = readJson(attendanceStudentsKey, []);

    const resultsContext = getResultsContext({
      classValue,
      section,
      exam: 'SA1',
    });
    const resultsStudentsKey = getResultsKey('students', resultsContext);
    const resultsStudents = readJson(resultsStudentsKey, []);

    const nextAttendanceStudents = shouldReplace ? [] : [...attendanceStudents];
    const nextResultsStudents = shouldReplace ? [] : [...resultsStudents];

    const attendanceSeen = new Set(
      nextAttendanceStudents.map((student) => `${String(student.rollNo).toLowerCase()}::${student.name.toLowerCase()}`),
    );
    const resultsSeen = new Set(
      nextResultsStudents.map((student) => `${String(student.rollNo).toLowerCase()}::${student.name.toLowerCase()}`),
    );

    let insertedCount = 0;

    incomingStudents.forEach((student, index) => {
      const name = student.name.trim();
      if (!name) return;

      const rollNo = String(student.rollNo || nextAttendanceStudents.length + index + 1).trim();
      const key = `${rollNo.toLowerCase()}::${name.toLowerCase()}`;

      if (!attendanceSeen.has(key)) {
        nextAttendanceStudents.push({ id: student.id || createId(), rollNo, name });
        attendanceSeen.add(key);
        insertedCount += 1;
      }

      if (!resultsSeen.has(key)) {
        nextResultsStudents.push({ id: student.id || createId(), rollNo, name });
        resultsSeen.add(key);
      }
    });

    writeJson(attendanceStudentsKey, nextAttendanceStudents);
    writeJson(resultsStudentsKey, nextResultsStudents);

    return { insertedCount, section };
  }

  function openEditStudentModal(student) {
    setEditingStudent(student);
    setEditStudentForm({
      classValue: student.classValue,
      section: student.section,
      rollNo: String(student.rollNo),
      name: student.name,
    });
    setIsEditStudentModalOpen(true);
  }

  function closeEditStudentModal() {
    setIsEditStudentModalOpen(false);
    setEditingStudent(null);
  }

  function updateEditStudentForm(field, value) {
    setEditStudentForm((current) => ({ ...current, [field]: value }));
  }

  function saveEditStudent() {
    if (!editingStudent) return;
    const name = editStudentForm.name.trim();
    if (!name) return;

    const rollNo = editStudentForm.rollNo.trim();
    const newClassValue = editStudentForm.classValue;
    const newSection = normalizeSection(editStudentForm.section);
    const oldClassValue = editingStudent.classValue;
    const oldSection = normalizeSection(editingStudent.section);
    const sameClass = oldClassValue === newClassValue && oldSection === newSection;

    // Update attendance store
    const oldAttKey = getAttendanceKey('students', { classValue: oldClassValue, section: oldSection });
    const oldAttStudents = readJson(oldAttKey, []);
    const matchedAttStudent = oldAttStudents.find(
      (s) => s.name === editingStudent.name && String(s.rollNo) === String(editingStudent.rollNo),
    );

    if (sameClass) {
      const updatedAtt = oldAttStudents.map((s) =>
        s.name === editingStudent.name && String(s.rollNo) === String(editingStudent.rollNo)
          ? { ...s, name, rollNo }
          : s,
      );
      writeJson(oldAttKey, updatedAtt);
    } else {
      writeJson(oldAttKey, oldAttStudents.filter((s) => !(s.name === editingStudent.name && String(s.rollNo) === String(editingStudent.rollNo))));
      const newAttKey = getAttendanceKey('students', { classValue: newClassValue, section: newSection });
      const newAttStudents = readJson(newAttKey, []);
      newAttStudents.push({ id: matchedAttStudent?.id || createId(), rollNo, name });
      writeJson(newAttKey, newAttStudents);
    }

    // Update results stores for all exam types
    for (const exam of ['SA1', 'SA2']) {
      const oldCtx = getResultsContext({ classValue: oldClassValue, section: oldSection, exam });
      const oldResKey = getResultsKey('students', oldCtx);
      const oldResStudents = readJson(oldResKey, []);
      const matchedRes = oldResStudents.find((s) => s.id === editingStudent.resultsStudentId)
        || oldResStudents.find((s) => s.name === editingStudent.name && String(s.rollNo) === String(editingStudent.rollNo));

      if (!matchedRes) continue;

      if (sameClass) {
        writeJson(oldResKey, oldResStudents.map((s) => (s.id === matchedRes.id ? { ...s, name, rollNo } : s)));
      } else {
        writeJson(oldResKey, oldResStudents.filter((s) => s.id !== matchedRes.id));
        const newCtx = getResultsContext({ classValue: newClassValue, section: newSection, exam });
        const newResKey = getResultsKey('students', newCtx);
        const newResStudents = readJson(newResKey, []);
        newResStudents.push({ id: matchedRes.id, rollNo, name });
        writeJson(newResKey, newResStudents);
      }
    }

    closeEditStudentModal();
    reloadStudents();
  }

  function saveNewStudent() {
    const name = newStudentForm.name.trim();
    if (!name) return;

    const rollNo = newStudentForm.rollNo.trim();
    const { section } = syncStudentsToClassStores(newStudentForm.classValue, newStudentForm.section, [
      {
        id: createId(),
        rollNo,
        name,
      },
    ]);

    setIsAddModalOpen(false);
    setNewStudentForm({ classValue: newStudentForm.classValue, section, rollNo: '', name: '' });
    reloadStudents();
  }

  function saveBulkStudents() {
    if (!bulkStudentText.trim()) return;

    const parsedStudents = parseStudentLines(bulkStudentText, 1);
    const { insertedCount } = syncStudentsToClassStores(
      newStudentForm.classValue,
      newStudentForm.section,
      parsedStudents,
      replaceClassStudents,
    );

    setBulkStudentText('');
    setReplaceClassStudents(false);
    setIsBulkModalOpen(false);
    reloadStudents();
    window.alert(`${insertedCount} student(s) added to Class ${newStudentForm.classValue}-${normalizeSection(newStudentForm.section)}.`);
  }

  const classFilterOptions = useMemo(() => {
    const unique = Array.from(new Set(students.map((student) => `${student.classValue}-${student.section}`)));
    return unique.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const classScoped = selectedClassFilter === 'ALL'
      ? students
      : students.filter((student) => `${student.classValue}-${student.section}` === selectedClassFilter);

    const query = searchQuery.trim().toLowerCase();
    if (!query) return classScoped;
    return classScoped.filter((student) => {
      const haystack = `${student.name} ${student.rollNo} ${student.classValue}-${student.section}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery, selectedClassFilter, students]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredStudents.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredStudents, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassFilter]);

  const firstVisibleRow = filteredStudents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisibleRow = Math.min(currentPage * pageSize, filteredStudents.length);

  const averageAttendance = filteredStudents.filter((student) => student.attendanceRate != null);
  const averageAttendanceValue = averageAttendance.length
    ? (averageAttendance.reduce((sum, student) => sum + student.attendanceRate, 0) / averageAttendance.length).toFixed(1)
    : '0.0';
  const averageScore = filteredStudents.filter((student) => student.resultPercent != null);
  const averageScoreValue = averageScore.length
    ? (averageScore.reduce((sum, student) => sum + student.resultPercent, 0) / averageScore.length / 25).toFixed(2)
    : '0.00';

  return (
    <StitchDesktopShell
      activeNav="students"
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search for students, IDs, or classes..."
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
        <section className="stitch-directory-header">
          <div className="stitch-page-heading-copy">
            <h1>Student Directory</h1>
            <p className="stitch-page-subtitle">Manage and monitor academic performance from your saved browser records.</p>
          </div>
        </section>

        <section className="stitch-inline-guide">
          <div>
            <strong>Marks are entered from the Exams page.</strong>
            <p>Open Exams, choose class, section, subject, and assessment, then type directly into the FA1, FA2, SA1, and Oral fields.</p>
          </div>
          <Link to="/results" className="stitch-inline-guide-link">
            <span className="material-symbols-outlined" aria-hidden="true">assignment</span>
            <span>Open Exams</span>
          </Link>
        </section>

        <section className="stitch-directory-metrics">
          <article className="stitch-directory-metric-card">
            <p>Total Active Students</p>
            <h3>{filteredStudents.length}</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>Average Class GPA</p>
            <h3>{averageScoreValue}</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>Daily Attendance</p>
            <h3>{averageAttendanceValue}%</h3>
          </article>
          <article className="stitch-directory-metric-card">
            <p>Pending Gradings</p>
            <h3>{filteredStudents.filter((student) => student.resultPercent == null).length}</h3>
          </article>
        </section>

        <section className="stitch-directory-mobile-list d-lg-none">
          <div className="stitch-directory-mobile-head">
            <h3>Class Roll</h3>
            <select
              className="stitch-records-filter-select"
              value={selectedClassFilter}
              onChange={(event) => setSelectedClassFilter(event.target.value)}
              aria-label="Filter students by class"
            >
              <option value="ALL">All Classes</option>
              {classFilterOptions.map((option) => (
                <option key={option} value={option}>Class {option}</option>
              ))}
            </select>
          </div>

          {filteredStudents.length === 0 ? (
            <article className="stitch-directory-mobile-card">
              <p>No student records found.</p>
            </article>
          ) : (
            paginatedStudents.map((student) => {
              const gpa = getGpaLabel(student.resultPercent);
              return (
                <article key={student.id} className="stitch-directory-mobile-card">
                  <div className="stitch-directory-mobile-main">
                    <div className="stitch-directory-avatar">{getInitials(student.name)}</div>
                    <div>
                      <h4>{student.name}</h4>
                      <p>Class {student.classValue}-{student.section} • Roll {student.rollNo}</p>
                      <div className="stitch-directory-mobile-stats">
                        <span>{student.attendanceRate != null ? `${student.attendanceRate}% Att.` : 'No attendance'}</span>
                        <span>{gpa.value} GPA</span>
                      </div>
                    </div>
                  </div>
                  <div className="stitch-directory-mobile-card-actions">
                    <Link
                      to={`/students/profile?id=${encodeURIComponent(student.id)}`}
                      className="stitch-directory-mobile-icon-btn"
                      aria-label={`Open profile for ${student.name}`}
                    >
                      <span className="material-symbols-outlined">account_circle</span>
                    </Link>
                    <button type="button" className="stitch-directory-mobile-icon-btn" aria-label={`Edit info for ${student.name}`} onClick={() => openEditStudentModal(student)}>
                      <span className="material-symbols-outlined">manage_accounts</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <section className="stitch-directory-table-shell">
          <div className="stitch-directory-filter-bar">
            <div>
              <button type="button" onClick={() => setIsBulkModalOpen(true)}>Bulk Add Students</button>
              <select
                className="stitch-records-filter-select"
                value={selectedClassFilter}
                onChange={(event) => setSelectedClassFilter(event.target.value)}
                aria-label="Filter students by class"
              >
                <option value="ALL">All Classes</option>
                {classFilterOptions.map((option) => (
                  <option key={option} value={option}>Class {option}</option>
                ))}
              </select>
            </div>
            <span>Displaying {firstVisibleRow}-{lastVisibleRow} of {filteredStudents.length} students</span>
          </div>

          <div className="stitch-directory-list">
            <div className="stitch-directory-list-head">
              <div>Student Information</div>
              <div>Attendance</div>
              <div>GPA Status</div>
              <div>Last Activity</div>
              <div>Actions</div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="stitch-directory-row stitch-directory-row--empty">No student records found.</div>
            ) : (
              paginatedStudents.map((student) => {
                const gpa = getGpaLabel(student.resultPercent);
                return (
                  <div key={student.id} className="stitch-directory-row">
                    <div className="stitch-directory-student">
                      <div className="stitch-directory-avatar">{getInitials(student.name)}</div>
                      <div>
                        <h4>{student.name}</h4>
                        <p>Student ID: SS-{String(student.rollNo).padStart(4, '0')} • Class {student.classValue}-{student.section}</p>
                      </div>
                    </div>

                    <div className="stitch-directory-attendance">
                      <div className="stitch-directory-bar"><span style={{ width: `${student.attendanceRate || 0}%` }} /></div>
                      <strong>{student.attendanceRate != null ? `${student.attendanceRate}%` : 'N/A'}</strong>
                    </div>

                    <div>
                      <span className={`stitch-directory-status stitch-directory-status--${gpa.tone}`}>
                        {gpa.value} / {gpa.label}
                      </span>
                    </div>

                    <div className="stitch-directory-activity">{student.lastActivity}</div>

                    <div className="stitch-directory-actions">
                      <Link to={`/students/profile?id=${encodeURIComponent(student.id)}`} className="stitch-directory-profile-link">
                        <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
                        <span>Profile</span>
                      </Link>
                      <button type="button" className="stitch-directory-edit-student-btn" onClick={() => openEditStudentModal(student)}>
                        <span className="material-symbols-outlined" aria-hidden="true">manage_accounts</span>
                        <span>Edit Info</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="stitch-directory-pagination">
            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Previous</button>
            <div>
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
              {totalPages > 1
                ? Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button key={page} type="button" className={page === currentPage ? 'is-active' : ''} onClick={() => setCurrentPage(page)}>
                      {page}
                    </button>
                  ))
                : null}
            </div>
            <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button>
          </div>
        </section>
      </main>

      <Modal title="Add Student" isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <div className="row g-2 mb-2">
          <div className="col-6">
            <label className="form-label">Class</label>
            <select className="form-select" value={newStudentForm.classValue} onChange={(event) => updateNewStudent('classValue', event.target.value)}>
              {['6', '7', '8', '9', '10'].map((value) => (
                <option key={value} value={value}>Class {value}</option>
              ))}
            </select>
          </div>
          <div className="col-6">
            <label className="form-label">Section</label>
            <input className="form-control" value={newStudentForm.section} maxLength={2} onChange={(event) => updateNewStudent('section', event.target.value)} />
          </div>
        </div>
        <div className="mb-2">
          <label className="form-label">Roll No</label>
          <input className="form-control" value={newStudentForm.rollNo} onChange={(event) => updateNewStudent('rollNo', event.target.value)} placeholder="Optional" />
        </div>
        <div className="mb-2">
          <label className="form-label">Student Name</label>
          <input className="form-control" value={newStudentForm.name} onChange={(event) => updateNewStudent('name', event.target.value)} />
        </div>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-light" onClick={() => { setIsAddModalOpen(false); setIsBulkModalOpen(true); }}>Bulk Add</button>
          <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={saveNewStudent}>Add Student</button>
        </div>
      </Modal>

      <Modal title="Bulk Add Students" isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} size="modal-dialog modal-lg">        <div className="row g-2 mb-2">
          <div className="col-6">
            <label className="form-label">Class</label>
            <select className="form-select" value={newStudentForm.classValue} onChange={(event) => updateNewStudent('classValue', event.target.value)}>
              {['6', '7', '8', '9', '10'].map((value) => (
                <option key={value} value={value}>Class {value}</option>
              ))}
            </select>
          </div>
          <div className="col-6">
            <label className="form-label">Section</label>
            <input className="form-control" value={newStudentForm.section} maxLength={2} onChange={(event) => updateNewStudent('section', event.target.value)} />
          </div>
        </div>
        <p className="text-muted small mb-2">One student per line. Use <strong>RollNo, Name</strong> (example: <strong>12, Riya Sharma</strong>) or just <strong>Name</strong>.</p>
        <textarea
          className="form-control font-monospace"
          rows={10}
          value={bulkStudentText}
          onChange={(event) => setBulkStudentText(event.target.value)}
          placeholder={"1, Aarav Kumar\n2, Sana Ali\n3, Nikhil Reddy"}
        />
        <div className="form-check mt-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="replaceStudentsDirectory"
            checked={replaceClassStudents}
            onChange={(event) => setReplaceClassStudents(event.target.checked)}
          />
          <label className="form-check-label text-danger" htmlFor="replaceStudentsDirectory">
            Replace existing student list for this class and section
          </label>
        </div>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-secondary" onClick={() => setIsBulkModalOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={saveBulkStudents}>Import Students</button>
        </div>
      </Modal>

      <Modal
        title={editingStudent ? `Edit Student — ${editingStudent.name}` : 'Edit Student'}
        isOpen={isEditStudentModalOpen}
        onClose={closeEditStudentModal}
      >
        <div className="row g-2 mb-2">
          <div className="col-6">
            <label className="form-label">Class</label>
            <select className="form-select" value={editStudentForm.classValue} onChange={(event) => updateEditStudentForm('classValue', event.target.value)}>
              {['6', '7', '8', '9', '10'].map((value) => (
                <option key={value} value={value}>Class {value}</option>
              ))}
            </select>
          </div>
          <div className="col-6">
            <label className="form-label">Section</label>
            <input className="form-control" value={editStudentForm.section} maxLength={2} onChange={(event) => updateEditStudentForm('section', event.target.value)} />
          </div>
        </div>
        <div className="mb-2">
          <label className="form-label">Roll No</label>
          <input className="form-control" value={editStudentForm.rollNo} onChange={(event) => updateEditStudentForm('rollNo', event.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Student Name</label>
          <input className="form-control" value={editStudentForm.name} onChange={(event) => updateEditStudentForm('name', event.target.value)} />
        </div>
        {editStudentForm.classValue !== editingStudent?.classValue || normalizeSection(editStudentForm.section) !== normalizeSection(editingStudent?.section || '') ? (
          <p className="text-warning small mb-2">
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle' }}>warning</span>
            {' '}Changing class / section will move the student to the new class. Marks data is not transferred.
          </p>
        ) : null}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-secondary" onClick={closeEditStudentModal}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={saveEditStudent}>Save Changes</button>
        </div>
      </Modal>
    </StitchDesktopShell>
  );
}