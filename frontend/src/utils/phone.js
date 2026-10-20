export function formatPhone(value, fallback = '미등록') {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const digits = text.replace(/-/g, '');
  if (/^02\d{7,8}$/.test(digits)) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
  if (/^0\d{9,10}$/.test(digits)) return digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  return text;
}
