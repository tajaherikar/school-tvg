export function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeSection(section) {
  return (section.trim() || 'A').toUpperCase();
}

export function parseStudentLines(text, startingIndex) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const commaIndex = line.indexOf(',');
      if (commaIndex > 0 && !Number.isNaN(Number(line.slice(0, commaIndex).trim()))) {
        return {
          id: `${createId()}${index}`,
          rollNo: line.slice(0, commaIndex).trim(),
          name: line.slice(commaIndex + 1).trim(),
        };
      }

      return {
        id: `${createId()}${index}`,
        rollNo: String(startingIndex + index),
        name: line,
      };
    })
    .filter((student) => student.name);
}
