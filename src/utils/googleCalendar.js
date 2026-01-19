export async function fetchGoogleCalendarEvents(token, startDate) {
  try {
    let allCalendars = [];
    let calPageToken = null;
    do {
      let calUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
      if (calPageToken) calUrl += `?pageToken=${calPageToken}`;

      const response = await fetch(calUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`Google API Error: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      if (data.items) allCalendars = allCalendars.concat(data.items);
      calPageToken = data.nextPageToken;
    } while (calPageToken);

    const targetName = 'atracker';
    let calendar = allCalendars.find(c => c.summary && c.summary.trim().toLowerCase() === targetName);
    if (!calendar) {
      calendar = allCalendars.find(c => c.summary && c.summary.toLowerCase().includes(targetName));
    }

    if (!calendar) {
      const foundNames = allCalendars.map(c => c.summary).join(", ");
      throw new Error(`Calendar 'ATracker' not found. I found: ${foundNames || "(None)"}.`);
    }

    let allEvents = [];
    let eventPageToken = null;
    do {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?singleEvents=true&orderBy=startTime&timeMin=${startDate.toISOString()}&maxResults=2500`;
      if (eventPageToken) url += `&pageToken=${eventPageToken}`;
      const eventsResponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (!eventsResponse.ok) {
        const errData = await eventsResponse.json();
        throw new Error(`Events Fetch Error: ${errData.error?.message || eventsResponse.statusText}`);
      }

      const eventsData = await eventsResponse.json();
      if (eventsData.items) allEvents = allEvents.concat(eventsData.items);
      eventPageToken = eventsData.nextPageToken;
    } while (eventPageToken);

    return allEvents;
  } catch (error) {
    console.error("Google Sync Error:", error);
    throw error;
  }
}
