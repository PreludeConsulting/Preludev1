# Contact and Discovery Call Page

Prelude exposes a public `/contact` route for families who want to book a discovery call or email the team before creating an account.

## User Flow

- `/contact#book-call` opens the scheduling card.
- Visitors choose an available date and 30-minute call start, add their contact details, then select **Request this time**.
- Availability is generated from separate windows: Monday-Friday, 10:00 AM-4:00 PM Eastern, and Saturday, 12:00 PM-3:00 PM Eastern.
- Visitors can only request calls inside a rolling 11-calendar-day range, which is roughly a week and a half including today. The range is recalculated in Eastern Time as time moves forward.
- The request is submitted to `/api/contact/book-call`, which locks that date + start time and emails Prelude support through Resend.
- Once a window is requested, `/api/contact/availability` stops offering it to other visitors until support cancels the reservation in Supabase.
- Prelude support receives an automated email with the appointment time and customer details.
- `/contact#email-us` opens the email section.
- **Open Gmail** launches a Gmail compose window with the same recipient and prefilled body.
- **Open email app** uses a standard `mailto:` URL for Apple Mail, Outlook, Gmail handlers, or the user's configured client.
- **Copy email** copies the recipient address for manual use.

## Implementation

- UI: `src/components/ContactPage.jsx`
- Styles: `src/styles/contact.css`
- Schedule/email helpers: `src/lib/contactSchedule.js`
- Booking API: `functions/api/contact/book-call.js`
- Availability API: `functions/api/contact/availability.js`
- Server helpers: `server/lib/contactBookings.js`, `server/lib/discoveryCallSlots.js`
- Slot lock migration: `supabase/migrations/20260805230000_discovery_call_slot_locks.sql`
- Tests: `tests/contactSchedule.test.js`, `tests/server/contactBookings.node.test.js`

Production requires Resend and Supabase service-role access:

```env
RESEND_API_KEY=
AUTH_EMAIL_FROM=Prelude <no-reply@preludeconsultingllc.com>
CONTACT_SUPPORT_EMAIL=preludesupport@preludeconsultingllc.com
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The booking API does not create calendar events or reminders. Mentors send Zoom links and any Zoom reminders separately. Slot locks live in `public.discovery_call_requests` with a unique index on active `(selected_date, selected_time)` rows.

## Updating Availability

Edit `CALL_WINDOWS` in `src/lib/contactSchedule.js` to change weekly hours.

Windows use day-of-week numbers and 24-hour Eastern Time strings. Sunday is `0`, Monday is `1`, and Saturday is `6`.

```js
weekday: {
  label: "Monday-Friday",
  days: [1, 2, 3, 4, 5],
  start: "10:00",
  end: "16:00"
},
saturday: {
  label: "Saturday",
  days: [6],
  start: "12:00",
  end: "15:00"
}
```

`AVAILABLE_CALL_SLOTS` is generated from these windows. Because discovery calls are 30 minutes, the last weekday call start is 3:30 PM and the last Saturday call start is 2:30 PM.

The rolling range is controlled by `BOOKING_WINDOW_DAYS`. It is currently set to `11`, so dates before today and dates beyond the next 11 calendar days are not bookable. Same-day time slots that have already passed are filtered out automatically.

`SCHEDULE_MONTHS` is generated from the rolling range, so the month navigation moves forward as the current date changes.

## QA Checklist

1. Visit `/contact`.
2. Confirm the card renders on desktop and mobile widths.
3. Select a date and time.
4. Fill name, email, student year, and topic.
5. Confirm **Request this time** sends the support email with the selected date, time, and customer details.
6. Confirm the same date/time disappears for a second visitor and returns HTTP 409 if requested again.
7. Confirm **Open Gmail** opens a Gmail compose URL with `to`, `su`, and `body` parameters.
8. Confirm **Open email app** opens a `mailto:` URL.
9. Run `npx vitest run tests/contactSchedule.test.js` and `node --test tests/server/contactBookings.node.test.js`.
