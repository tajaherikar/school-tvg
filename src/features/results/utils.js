export function calculateResultRow(fa1Raw, fa2Raw, sa1Raw, oralRaw) {
  const fa1 = Number.parseFloat(fa1Raw) || 0;
  const fa2 = Number.parseFloat(fa2Raw) || 0;
  const sa1 = Number.parseFloat(sa1Raw) || 0;
  const oral = Number.parseFloat(oralRaw) || 0;

  const fa1c = (Math.min(fa1, 20) / 20) * 10;
  const fa2c = (Math.min(fa2, 20) / 20) * 10;
  const sa1c = (Math.min(sa1, 40) / 40) * 20;
  const oralc = Math.min(oral, 10);
  const total = fa1c + fa2c + sa1c + oralc;

  return {
    fa1c: fa1c.toFixed(2),
    fa2c: fa2c.toFixed(2),
    sa1c: sa1c.toFixed(2),
    oralc: oralc.toFixed(2),
    total: total.toFixed(2),
  };
}

export function getGradeInfo(total50) {
  const percentage = (total50 / 50) * 100;
  if (percentage >= 91) return { grade: 'O', className: 'grade-O', pass: true };
  if (percentage >= 81) return { grade: 'A+', className: 'grade-Aplus', pass: true };
  if (percentage >= 71) return { grade: 'A', className: 'grade-A', pass: true };
  if (percentage >= 61) return { grade: 'B+', className: 'grade-Bplus', pass: true };
  if (percentage >= 51) return { grade: 'B', className: 'grade-B', pass: true };
  if (percentage >= 41) return { grade: 'C', className: 'grade-C', pass: true };
  if (percentage >= 35) return { grade: 'D', className: 'grade-D', pass: true };
  return { grade: 'F', className: 'grade-F', pass: false };
}

export function getStudentResult(markRow) {
  const hasAny = ['fa1', 'fa2', 'sa1', 'oral'].some((field) => markRow?.[field] !== '' && markRow?.[field] != null);
  if (!hasAny) return null;

  const converted = calculateResultRow(markRow.fa1, markRow.fa2, markRow.sa1, markRow.oral);
  const total = Number.parseFloat(converted.total);
  const percentage = ((total / 50) * 100).toFixed(1);
  return {
    converted,
    total,
    percentage,
    gradeInfo: getGradeInfo(total),
  };
}

export function getResultsSummary(students, marks) {
  const totals = students
    .map((student) => getStudentResult(marks[student.id] || {}))
    .filter(Boolean)
    .map((item) => item.total);

  if (totals.length === 0) {
    return {
      count: 0,
      pass: 0,
      fail: 0,
      passPercentage: '0.0',
      average: '0.00',
      highest: '0.00',
      lowest: '0.00',
    };
  }

  const pass = totals.filter((total) => total >= 17.5).length;
  const average = totals.reduce((sum, total) => sum + total, 0) / totals.length;

  return {
    count: totals.length,
    pass,
    fail: totals.length - pass,
    passPercentage: ((pass / totals.length) * 100).toFixed(1),
    average: average.toFixed(2),
    highest: Math.max(...totals).toFixed(2),
    lowest: Math.min(...totals).toFixed(2),
  };
}

export function buildResultsExportRows({ students, marks, examLabel, examComponentLabel = 'SA1', classValue, section, subject, academicYear = '2026-27' }) {
  const rows = [
    [`${examLabel} Examination Results — Class ${classValue}${section}  ${subject ? `| ${subject}` : ''}  |  Academic Year ${academicYear}`],
    [],
    [
      '#',
      'Student Name',
      'FA1 Raw(/20)',
      'FA1 Conv(/10)',
      'FA2 Raw(/20)',
      'FA2 Conv(/10)',
      `${examComponentLabel} Raw(/40)`,
      `${examComponentLabel} Conv(/20)`,
      'Oral Raw(/10)',
      'Oral Conv(/10)',
      'Total(/50)',
      '%',
      'Grade',
      'Result',
    ],
  ];

  students.forEach((student) => {
    const markRow = marks[student.id] || {};
    const result = getStudentResult(markRow);
    if (!result) {
      rows.push([student.rollNo, student.name, '', '', '', '', '', '', '', '', '', '', '', '']);
      return;
    }

    rows.push([
      student.rollNo,
      student.name,
      markRow.fa1 ?? '',
      result.converted.fa1c,
      markRow.fa2 ?? '',
      result.converted.fa2c,
      markRow.sa1 ?? '',
      result.converted.sa1c,
      markRow.oral ?? '',
      result.converted.oralc,
      result.converted.total,
      `${result.percentage}%`,
      result.gradeInfo.grade,
      result.gradeInfo.pass ? 'PASS' : 'FAIL',
    ]);
  });

  return rows;
}
