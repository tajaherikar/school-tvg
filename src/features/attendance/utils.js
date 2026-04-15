import { DAY_ABBREVIATIONS, MONTH_NAMES } from '../../lib/constants';

export function getMonthYear(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, monthIndex: month - 1 };
}

export function getDaysInMonth(monthKey) {
  const { year, monthIndex } = getMonthYear(monthKey);
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function getDayOfWeek(monthKey, dayNumber) {
  const { year, monthIndex } = getMonthYear(monthKey);
  return new Date(year, monthIndex, dayNumber).getDay();
}

export function getDayStatus(dayNumber, monthKey, periodDays, holidays) {
  if (getDayOfWeek(monthKey, dayNumber) === 0) return 'sunday';
  if (holidays[dayNumber]) return 'holiday';
  if (periodDays[dayNumber]) return 'period';
  return 'working';
}

export function cycleDayStatus(dayNumber, monthKey, periodDays, holidays) {
  const nextPeriodDays = { ...periodDays };
  const nextHolidays = { ...holidays };
  const currentStatus = getDayStatus(dayNumber, monthKey, periodDays, holidays);

  if (currentStatus === 'working') {
    nextPeriodDays[dayNumber] = true;
    delete nextHolidays[dayNumber];
  } else if (currentStatus === 'period') {
    delete nextPeriodDays[dayNumber];
    nextHolidays[dayNumber] = true;
  } else if (currentStatus === 'holiday') {
    delete nextPeriodDays[dayNumber];
    delete nextHolidays[dayNumber];
  }

  return { periodDays: nextPeriodDays, holidays: nextHolidays };
}

export function toggleAttendanceMark(currentMark) {
  if (currentMark === '') return 'P';
  if (currentMark === 'P') return 'A';
  return '';
}

export function calculateAttendanceRow(studentId, daysInMonth, monthKey, periodDays, holidays, marks) {
  let totalPeriods = 0;
  let attended = 0;

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    if (getDayStatus(dayNumber, monthKey, periodDays, holidays) === 'period') {
      totalPeriods += 1;
      if (marks[studentId]?.[dayNumber] === 'P') attended += 1;
    }
  }

  const percentage = totalPeriods > 0 ? Math.round((attended / totalPeriods) * 100) : 0;
  return {
    totalPeriods,
    attended,
    percentage,
    percentageClass: percentage >= 75 ? 'pct-good' : percentage >= 60 ? 'pct-warn' : 'pct-bad',
  };
}

export function buildAttendanceFooterCounts(students, daysInMonth, monthKey, periodDays, holidays, marks) {
  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    if (getDayStatus(dayNumber, monthKey, periodDays, holidays) !== 'period') return '';
    return students.filter((student) => marks[student.id]?.[dayNumber] === 'P').length;
  });
}

export function getPeriodDayOptions(daysInMonth, monthKey, periodDays, holidays) {
  return Array.from({ length: daysInMonth }, (_, index) => index + 1)
    .filter((dayNumber) => getDayStatus(dayNumber, monthKey, periodDays, holidays) === 'period')
    .map((dayNumber) => ({
      value: String(dayNumber),
      label: `${dayNumber} ${DAY_ABBREVIATIONS[getDayOfWeek(monthKey, dayNumber)]}`,
    }));
}

export function buildAttendanceExportRows({
  students,
  monthKey,
  subject,
  classValue,
  section,
  academicYear = '2026-27',
  periodDays,
  holidays,
  marks,
}) {
  const { year, monthIndex } = getMonthYear(monthKey);
  const daysInMonth = getDaysInMonth(monthKey);
  const rows = [
    [`Attendance Sheet — Class ${classValue}${section}  ${subject ? `| ${subject}` : ''}  |  ${MONTH_NAMES[monthIndex]} ${year}  |  Academic Year ${academicYear}`],
    [],
  ];

  const header = ['Roll No', 'Student Name'];
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const status = getDayStatus(dayNumber, monthKey, periodDays, holidays);
    const dayLabel = DAY_ABBREVIATIONS[getDayOfWeek(monthKey, dayNumber)];
    if (status === 'sunday') header.push(`${dayNumber} ${dayLabel} (Sun)`);
    else if (status === 'holiday') header.push(`${dayNumber} ${dayLabel} GH`);
    else header.push(`${dayNumber} ${dayLabel}`);
  }
  header.push('Total Periods', 'Days Present', 'Attendance %');
  rows.push(header);

  students.forEach((student) => {
    const rowStats = calculateAttendanceRow(student.id, daysInMonth, monthKey, periodDays, holidays, marks);
    const row = [student.rollNo, student.name];
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const status = getDayStatus(dayNumber, monthKey, periodDays, holidays);
      if (status === 'period') row.push(marks[student.id]?.[dayNumber] || '');
      else if (status === 'sunday') row.push('Sun');
      else if (status === 'holiday') row.push('GH');
      else row.push('');
    }
    row.push(rowStats.totalPeriods, rowStats.attended, `${rowStats.percentage}%`);
    rows.push(row);
  });

  rows.push(['', 'Present Count →', ...buildAttendanceFooterCounts(students, daysInMonth, monthKey, periodDays, holidays, marks), '', '', '']);
  return rows;
}
