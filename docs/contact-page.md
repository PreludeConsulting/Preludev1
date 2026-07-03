# Contact and Discovery Call Page

Prelude exposes a public `/contact` route for families who want to book a discovery call or email the team before creating an account.

## User Flow

- `/contact#book-call` opens the scheduling card.
- Visitors choose an available date and 30-minute call start, add their contact details, then select **Request this time**.
- Availability is generated from separate windows: Monday-Friday, 10:00 AM-4:00 PM Eastern, and Saturday, 12:00 PM-3:00 PM Eastern.
- Visitors can only request calls inside a rolling 11-calendar-day range, which is roughly a week and a half including today. The range is recalculated in Eastern Time as time moves forward.
- The request is submitted to `/api/contact/book-call`, stored in Supabase, and sent through Resend.
- Prelude support receives an automated email with the appointment time and customer details.
- The customer receives a confirmation email immediately.
- A protected reminder endpoint sends a customer reminder email 30 minutes before the appointment.
- `/contact#email-us` opens the email section.
- **Open Gmail** launches a Gmail compose window with the same recipient and prefilled body.
- **Open email app** uses a standard `mailto:` URL for Apple Mail, Outlook, Gmail handlers, or the user's configured client.
- **Copy email** copies the recipient address for manual use.

## Implementation

- UI: `src/components/ContactPage.jsx`
- Styles: `src/styles/contact.css`
- Schedule/email helpers: `src/lib/contactSchedule.js`
- Booking API: `functions/api/contact/book-call.js`
- Reminder API: `functions/api/contact/send-reminders.js`
- Server helper: `server/lib/contactBookings.js`
- Database table: `public.contact_call_bookings`
- Tests: `tests/contactSchedule.test.js`

Production requires Supabase service credentials and Resend:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
AUTH_EMAIL_FROM=Prelude <no-reply@preludeconsultingllc.com>
CONTACT_SUPPORT_EMAIL=preludesupport@preludeconsultingllc.com
CONTACT_SUPPORT_PHONE=
CONTACT_INSTRUCTIONS=
CONTACT_REMINDER_SECRET=
```

Run the Supabase migration `20260705000000_contact_call_bookings.sql` before enabling live bookings.

To send 30-minute reminders, call `/api/contact/send-reminders` every 5-10 minutes from Cloudflare Cron or another scheduler with:

```http
Authorization: Bearer CONTACT_REMINDER_SECRET
```

SMS reminders are not enabled yet because the project does not currently include an SMS provider. The reminder email includes the booking row's `support_phone` and `contact_instructions` values when present, then falls back to `CONTACT_SUPPORT_PHONE` and `CONTACT_INSTRUCTIONS`.

To customize phone/contact details per appointment, open the booking row in Supabase Table Editor and edit:

- `support_phone`
- `contact_instructions`

Do that before the 30-minute reminder endpoint runs for that appointment.

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
5. Confirm **Request this time** stores a booking and sends the support/customer emails.
6. Confirm **Open Gmail** opens a Gmail compose URL with `to`, `su`, and `body` parameters.
7. Confirm **Open email app** opens a `mailto:` URL.
8. Call `/api/contact/send-reminders` with the bearer secret after creating a due test booking.
9. Run `npx.cmd vitest run tests/contactSchedule.test.js`.
