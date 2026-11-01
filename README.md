# Railway Reservation System

React (Vite) frontend + Express/MongoDB backend.

## Run
```
cd backend  && npm install && npm start      # needs backend/.env: MONGODB_URI, JWT_SECRET, (PORT)
cd frontend && npm install && npm run dev
node backend/src/scripts/seedSeatAvailability.js [YYYY-MM-DD]   # sample seats, incl. a sold-out class (12608 / CC)
```
Tests: `cd backend && npm test`. Set `MONGODB_TEST_URI` (a throw-away database) to also run the integration tests.

## Sprint 2
### BL-14 Waitlist monitoring (UC-07, FR-09, TC_08)
* **Joining:** if a class cannot seat everyone, the passenger page offers *Join Waitlist*. No seat is held; the passenger pays and gets a PNR with status `WAITLISTED`. Max 20 waitlisted seats per train/date/class.
* **Clearing:** freed seats (cancellations, expired payment holds) confirm the queue automatically, strictly first-come-first-served. A ticket still waitlisted at departure is auto-cancelled with a full refund. Cancelling a waitlisted ticket also refunds 100%.
* **Monitoring:** new **Waitlist** page (`#/waitlist`): live position (`WL/n`), tickets ahead, seats needed/free, auto-refresh every 15 s, and a PNR check (unknown PNR -> not-found message).
* **API:** `POST /api/bookings` accepts `joinWaitlist: true` (fallback only); `GET /api/waitlist` and `GET /api/waitlist/:pnr` (login required, own tickets only); availability now returns `waitlistedSeats` / `waitlistSeatsRemaining`.

### BL-15 Language selection (UC-08, FR-08, NFR-04, TC_09)
* Header language menu: English, Hindi, Kannada, Tamil. The whole UI switches instantly; the choice is kept in the browser and, when logged in, on the account (`PUT /api/users/me/language`, restored at login).
* Marathi / Bengali / Telugu are listed as "not available yet": choosing one is not applied and shows a message (UC-08 alt. flow). The server also rejects unsupported codes.
* Add a language: create `frontend/src/i18n/translations/xx.js`, register it in `translate.js` and `languages.js`, and in `backend/src/config/languages.js`.
* Server error messages (from the API) are still English.
