export function applyOrdering(
  rows: Array<{ group: Record<string, string>; metrics: Record<string, number> }>,
  orderBy: Array<[string, string]>,
) {
  if (orderBy.length === 0) {
    return rows;
  }

  const [field, direction] = orderBy[0];
  const factor = direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const aValue = a.group[field] ?? a.metrics[field];
    const bValue = b.group[field] ?? b.metrics[field];

    if (aValue === bValue) return 0;
    if (aValue === undefined) return 1;
    if (bValue === undefined) return -1;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * factor;
    }

    return String(aValue).localeCompare(String(bValue)) * factor;
  });
}
