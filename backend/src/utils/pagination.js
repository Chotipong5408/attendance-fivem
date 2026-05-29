function getPaginationParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function paginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

function startOfDay(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day').value, 10);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

function endOfDay(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day').value, 10);
  // UTC 16:59 is Local 23:59 in GMT+7. This prevents timezone spillover to the next day.
  return new Date(Date.UTC(year, month, day, 16, 59, 59, 999));
}

function getBangkokTimeBounds(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(d);
  const year = parseInt(parts.find(p => p.type === 'year').value, 10);
  const month = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
  const day = parseInt(parts.find(p => p.type === 'day').value, 10);

  // Bangkok is UTC+7. 
  // 00:00:00 Bangkok = 17:00:00 UTC of previous day
  // 23:59:59.999 Bangkok = 16:59:59.999 UTC of current day
  const start = new Date(Date.UTC(year, month, day, -7, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, day, 16, 59, 59, 999));
  
  return { start, end };
}

module.exports = { getPaginationParams, paginatedResponse, startOfDay, endOfDay, getBangkokTimeBounds };
