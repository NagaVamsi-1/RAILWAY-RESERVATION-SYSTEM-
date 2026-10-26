import { useCallback, useEffect, useState } from "react";
import { API, request } from "./api";

// Loads the authoritative booking from the backend (GET /api/bookings/:id).
export function useBooking(bookingId) {
  const [state, setState] = useState({ booking: null, loading: true, error: "" });

  const reload = useCallback(async () => {
    try {
      const data = await request(`${API}/bookings/${encodeURIComponent(bookingId)}`);
      setState({ booking: data.booking, loading: false, error: "" });
      return data.booking;
    } catch (err) {
      setState({ booking: null, loading: false, error: err.message });
      return null;
    }
  }, [bookingId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { ...state, reload };
}
