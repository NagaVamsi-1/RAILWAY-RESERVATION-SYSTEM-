// BL-14: Waitlist rules (UC-07, FR-09).
//
// When a class is sold out, a passenger may still book and pay. The ticket gets a
// PNR with status WAITLISTED and no seat is held. When seats are freed (a cancellation
// or an expired payment hold) the waitlist is cleared first-come-first-served and the
// ticket becomes CONFIRMED automatically. If it is still waitlisted when the train
// departs, it is cancelled with a full refund.

// Maximum number of waitlisted seats per train, date and class.
const MAX_WAITLIST_SEATS = 20;

module.exports = { MAX_WAITLIST_SEATS };
