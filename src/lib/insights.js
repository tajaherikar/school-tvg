import { calculateAttendanceRow, getDayStatus, getDaysInMonth } from '../features/attendance/utils';
import { getStudentResult } from '../features/results/utils';
import { normalizeSection, readJson } from './storage';

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

function parseClassSection(suffix) {
  const parts = suffix.split('_');
  return {
    classValue: parts[0] || '6',
    section: parts.slice(1).join('_') || 'A',
  };
}

function buildLatestAttendanceContexts() {
  const studentKeys = getStorageKeys('tvg_att_students_');
  return studentKeys
    .map((studentKey) => {
      const suffix = studentKey.replace('tvg_att_students_', '');
      const { classValue, section } = parseClassSection(suffix);
      const configPrefix = `tvg_att_config_${classValue}_${section}_`;
      const configKeys = getStorageKeys(configPrefix);
      const monthKey = configKeys
        .map((key) => key.replace(configPrefix, ''))
        .sort()
        .at(-1);

      if (!monthKey) {
        return {
          classValue,
          section,
          monthKey: null,
          students: readJson(studentKey, []),
          periodDays: {},
          holidays: {},
          marks: {},
          lateFlags: {},
        };
      }

      const config = readJson(`${configPrefix}${monthKey}`, {});
      const marks = readJson(`tvg_att_marks_${classValue}_${section}_${monthKey}`, {});

      return {
        classValue,
        section,
        monthKey,
        students: readJson(studentKey, []),
        periodDays: config.periodDays || {},
        holidays: config.holidays || {},
        lateFlags: config.lateFlags || {},
        marks,
      };
    })
    .sort((left, right) => `${left.classValue}${left.section}`.localeCompare(`${right.classValue}${right.section}`));
}

function buildLatestResultsContexts() {
  const studentKeys = getStorageKeys('tvg_res_students_');
  const examOrder = { SA1: 1, SA2: 2 };

  return studentKeys
    .map((studentKey) => {
      const suffix = studentKey.replace('tvg_res_students_', '');
      const { classValue, section } = parseClassSection(suffix);
      const marksPrefix = `tvg_res_marks_${classValue}_${section}_`;
      const exam = getStorageKeys(marksPrefix)
        .map((key) => key.replace(marksPrefix, ''))
        .sort((left, right) => (examOrder[left] || 0) - (examOrder[right] || 0))
        .at(-1);

      return {
        classValue,
        section,
        exam: exam || 'SA1',
        students: readJson(studentKey, []),
        marks: readJson(`${marksPrefix}${exam || 'SA1'}`, {}),
      };
    })
    .sort((left, right) => `${left.classValue}${left.section}`.localeCompare(`${right.classValue}${right.section}`));
}

export function getUnifiedStudentDirectory() {
  const attendanceContexts = buildLatestAttendanceContexts();
  const resultsContexts = buildLatestResultsContexts();
  const directory = new Map();

  attendanceContexts.forEach((context) => {
    context.students.forEach((student) => {
      const key = `${context.classValue}_${context.section}_${student.rollNo}_${student.name}`;
      const attendanceRate = context.monthKey
        ? calculateAttendanceRow(student.id, 31, context.monthKey, context.periodDays, context.holidays, context.marks).percentage
        : null;

      directory.set(key, {
        id: key,
        name: student.name,
        rollNo: student.rollNo,
        classValue: context.classValue,
        section: context.section,
        attendanceRate,
        resultPercent: null,
        grade: null,
        resultExam: null,
        resultsStudentId: null,
        lastActivity: context.monthKey ? `Attendance ${context.monthKey}` : 'Attendance roster',
      });
    });
  });

  resultsContexts.forEach((context) => {
    context.students.forEach((student) => {
      const key = `${context.classValue}_${context.section}_${student.rollNo}_${student.name}`;
      const result = getStudentResult(context.marks[student.id] || {});
      const existing = directory.get(key) || {
        id: key,
        name: student.name,
        rollNo: student.rollNo,
        classValue: context.classValue,
        section: context.section,
        attendanceRate: null,
      };

      directory.set(key, {
        ...existing,
        resultPercent: result ? Number(result.percentage) : null,
        grade: result?.gradeInfo.grade || null,
        resultExam: context.exam,
        resultsStudentId: student.id,
        lastActivity: result ? `${context.exam} results` : existing.lastActivity || 'Student roster',
      });
    });
  });

  return Array.from(directory.values()).sort((left, right) => {
    if (`${left.classValue}${left.section}` !== `${right.classValue}${right.section}`) {
      return `${left.classValue}${left.section}`.localeCompare(`${right.classValue}${right.section}`);
    }
    return String(left.rollNo).localeCompare(String(right.rollNo), undefined, { numeric: true });
  });
}

export function getDashboardInsights() {
  const students = getUnifiedStudentDirectory();
  const attendanceValues = students.map((student) => student.attendanceRate).filter((value) => value != null);
  const resultValues = students.map((student) => student.resultPercent).filter((value) => value != null);
  const averageAttendance = attendanceValues.length
    ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length)
    : 0;
  const averageResult = resultValues.length
    ? resultValues.reduce((sum, value) => sum + value, 0) / resultValues.length
    : 0;
  const averageGpa = (averageResult / 25).toFixed(2);
  const atRiskStudents = students.filter((student) => (student.resultPercent ?? 100) < 35 || (student.attendanceRate ?? 100) < 75);
  const topStudents = [...students]
    .filter((student) => student.resultPercent != null)
    .sort((left, right) => (right.resultPercent || 0) - (left.resultPercent || 0))
    .slice(0, 4);

  return {
    totalStudents: students.length,
    averageAttendance,
    averageResult: averageResult.toFixed(1),
    averageGpa,
    pendingGradings: students.filter((student) => student.resultPercent == null).length,
    atRiskCount: atRiskStudents.length,
    presentTodayEstimate: Math.round((averageAttendance / 100) * students.length),
    recentPerformance: topStudents,
  };
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

export function getStudentDrilldownProfile(criteria = {}) {
  const students = getUnifiedStudentDirectory();
  const target = students.find((student) => {
    if (criteria.id && student.id === criteria.id) return true;
    const classMatch = String(student.classValue) === String(criteria.classValue || '');
    const sectionMatch = normalizeSection(student.section) === normalizeSection(criteria.section || '');
    const rollMatch = String(student.rollNo) === String(criteria.rollNo || '');
    const nameMatch = String(student.name || '').toLowerCase() === String(criteria.name || '').toLowerCase();
    return classMatch && sectionMatch && (rollMatch || nameMatch);
  });

  if (!target) return null;

  const classKey = `${target.classValue}_${normalizeSection(target.section)}`;
  const identityKey = `${String(target.rollNo).toLowerCase()}::${target.name.toLowerCase()}`;

  const attendanceStudents = readJson(`tvg_att_students_${classKey}`, []);
  const attendanceMatch = attendanceStudents.find(
    (item) => `${String(item.rollNo).toLowerCase()}::${item.name.toLowerCase()}` === identityKey,
  );

  const monthKeys = getStorageKeys(`tvg_att_config_${classKey}_`)
    .map((key) => key.replace(`tvg_att_config_${classKey}_`, ''))
    .sort();

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
  const resultMatch = resultsStudents.find((item) => item.id === target.resultsStudentId)
    || resultsStudents.find((item) => `${String(item.rollNo).toLowerCase()}::${item.name.toLowerCase()}` === identityKey);

  const examKeys = getStorageKeys(`tvg_res_marks_${classKey}_`)
    .map((key) => key.replace(`tvg_res_marks_${classKey}_`, ''))
    .sort((left, right) => (EXAM_ORDER[left] || 99) - (EXAM_ORDER[right] || 99));

  const examHistory = examKeys
    .map((exam) => {
      if (!resultMatch) return null;
      const marks = readJson(`tvg_res_marks_${classKey}_${exam}`, {});
      const markRow = marks[resultMatch.id] || {};
      const result = getStudentResult(markRow);
      if (!result) return null;

      return {
        exam,
        raw: {
          fa1: markRow.fa1 ?? '',
          fa2: markRow.fa2 ?? '',
          exam40: markRow.sa1 ?? '',
          oral: markRow.oral ?? '',
        },
        converted: result.converted,
        percentage: Number(result.percentage),
        grade: result.gradeInfo.grade,
      };
    })
    .filter(Boolean);

  const latestAttendance = monthlyAttendance.at(-1) || null;
  const latestExam = examHistory.at(-1) || null;
  const attendanceAverage = monthlyAttendance.length
    ? Math.round(monthlyAttendance.reduce((sum, month) => sum + month.percentage, 0) / monthlyAttendance.length)
    : null;
  const examAverage = examHistory.length
    ? Number((examHistory.reduce((sum, exam) => sum + exam.percentage, 0) / examHistory.length).toFixed(1))
    : null;

  return {
    ...target,
    attendanceAverage,
    examAverage,
    latestAttendance,
    latestExam,
    monthlyAttendance,
    examHistory,
  };
}