import { normalizeSection } from '../../lib/storage';

export function getResultsContext(form) {
  return {
    classValue: form.classValue,
    section: normalizeSection(form.section),
    exam: form.exam,
  };
}

export function getResultsKey(type, context) {
  const classKey = `${context.classValue}_${context.section}`;
  if (type === 'students') return `tvg_res_students_${classKey}`;
  if (type === 'marks') return `tvg_res_marks_${classKey}_${context.exam}`;
  if (type === 'attendanceStudents') return `tvg_att_students_${classKey}`;
  throw new Error(`Unsupported results key type: ${type}`);
}
