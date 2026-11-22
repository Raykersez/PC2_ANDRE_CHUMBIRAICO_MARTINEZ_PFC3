export const checklistVersion = 1;
export const sanitaryChecklist = [
  { code: 'hygiene', label: 'Higiene del puesto' },
  { code: 'handling', label: 'Manipulación de alimentos' },
  { code: 'storage', label: 'Almacenamiento' },
];

export function inspectionAnswers(input) {
  const answers = {};
  const fields = {};
  for (const { code } of sanitaryChecklist) {
    const answer = input?.[code];
    if (answer !== 'compliant' && answer !== 'noncompliant') fields[code] = 'Indica si el criterio se cumple.';
    else answers[code] = answer;
  }
  if (Object.keys(fields).length) return { fields };
  const result = Object.values(answers).includes('noncompliant') ? 'noncompliant' : 'compliant';
  return { answers, result };
}

export const submissionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
