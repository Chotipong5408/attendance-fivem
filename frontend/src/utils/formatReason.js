export function formatReason(reasonStr) {
  if (!reasonStr) return '-';
  try {
    const parsed = JSON.parse(reasonStr);
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k} น.: ${v}`)
        .join(' | ');
    }
  } catch (e) {
    // Ignore error, treat as raw string
  }
  return reasonStr;
}
