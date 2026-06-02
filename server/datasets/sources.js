export const COLLEGE_SCORECARD_SOURCE = "College Scorecard — U.S. Department of Education";
export const ONET_SOURCE = "O*NET database — U.S. Department of Labor, Employment and Training Administration";
export const NCES_CCD_SOURCE = "NCES Common Core of Data — U.S. Department of Education";

export function highSchoolSource(row) {
  return cleanText(row?.source) ?? NCES_CCD_SOURCE;
}

export function collegeSource(row) {
  return cleanText(row?.source) ?? COLLEGE_SCORECARD_SOURCE;
}

export function programSource(row) {
  return cleanText(row?.source) ?? COLLEGE_SCORECARD_SOURCE;
}

function cleanText(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed && trimmed !== "NA" ? trimmed : null;
}
