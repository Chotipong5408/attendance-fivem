import { useState, useEffect } from 'react';
import { settingsApi } from '../api/client';

export function useSlots() {
  const [attendanceSlots, setAttendanceSlots] = useState([]);
  const [leaveSlots, setLeaveSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSlots();
      setAttendanceSlots(data.attendanceSlots || []);
      setLeaveSlots(data.leaveSlots || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  return { attendanceSlots, leaveSlots, loading, error, refetch: fetchSlots };
}
