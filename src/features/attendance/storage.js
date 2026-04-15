import { normalizeSection } from '../../lib/storage';

export function getAttendanceContext(form) {
  const section = normalizeSection(form.section);
  return {
    classValue: form.classValue,
    section,
    monthKey: form.month,
  };
}

export function getAttendanceKey(type, context) {
  const classKey = `${context.classValue}_${context.section}`;
  if (type === 'students') return `tvg_att_students_${classKey}`;
  if (type === 'config') return `tvg_att_config_${classKey}_${context.monthKey}`;
  if (type === 'marks') return `tvg_att_marks_${classKey}_${context.monthKey}`;
  throw new Error(`Unsupported attendance key type: ${type}`);
}
