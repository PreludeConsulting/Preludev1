export function isValidIsoDate(value) {
  const date = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
  );
}

export function isValidTime24(value) {
  const time = value?.trim() ?? "";
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [hours, minutes] = time.split(":").map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
}

export function time24ToMinutes(value) {
  const [hours, minutes] = value.trim().split(":").map(Number);
  return hours * 60 + minutes;
}

export function isScheduleFormValid(form) {
  const title = form.title?.trim() ?? "";
  const date = form.date?.trim() ?? "";
  const startTime = form.startTime?.trim() ?? "";
  const endTime = form.endTime?.trim() ?? "";

  if (!title) return false;
  if (!isValidIsoDate(date)) return false;
  if (!isValidTime24(startTime)) return false;
  if (!isValidTime24(endTime)) return false;
  if (time24ToMinutes(endTime) <= time24ToMinutes(startTime)) return false;
  return true;
}
