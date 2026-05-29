export function getUserDisplayName(user) {
  if (!user) return '-';
  return user.displayName || user.icName || user.username || '-';
}
