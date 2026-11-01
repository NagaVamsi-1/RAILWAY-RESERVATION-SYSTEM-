import { useCallback, useEffect, useState } from "react";
import { API, request } from "../api";
import { StatusBadge } from "../components/BookingSummary";
import { navigate } from "../router";
import { useI18n } from "../i18n/useI18n";
import "../components/payment.css";
import "./WaitlistPage.css";

const REFRESH_MS = 15000;

function WaitlistCard({ item, highlight = false }) {
  const { t, city } = useI18n();
  const { booking, waitlist } = item;
  const waiting = waitlist.state === "WAITING";

  return (
    <article
      className={`waitlist-card state-${waitlist.state.toLowerCase()} ${highlight ? "highlight" : ""}`}
    >
      <div className="waitlist-card-head">
        <div>
          <p className="eyebrow">{t("pnr.pnr")}</p>
          <p className="pnr-number">{booking.pnr}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="waitlist-position" aria-label={t("waitlist.positionLabel", { label: waitlist.label })}>
        <span className="waitlist-label">{waitlist.label}</span>
        <p>{t(`waitlist.state.${waitlist.state}`, undefined, waitlist.message)}</p>
      </div>

      <div className="confirmation-details">
        <span>{t("pnr.train")}</span>
        <strong>{booking.trainNumber} · {booking.trainName}</strong>
        <span>{t("common.route")}</span>
        <strong>{city(booking.source)} → {city(booking.destination)}</strong>
        <span>{t("common.journeyDate")}</span>
        <strong>
          {booking.journeyDate?.slice(0, 10)} · {t("common.departs", { time: booking.departure })}
        </strong>
        <span>{t("common.class")}</span>
        <strong>{booking.travelClass}</strong>
        <span>{t("common.passengers")}</span>
        <strong>{booking.seatCount}</strong>

        {waiting && (
          <>
            <span>{t("waitlist.position")}</span>
            <strong>{waitlist.position}</strong>
            <span>{t("waitlist.ahead")}</span>
            <strong>{waitlist.bookingsAhead}</strong>
            <span>{t("waitlist.seatsAhead")}</span>
            <strong>{waitlist.seatsAhead}</strong>
            <span>{t("waitlist.queue")}</span>
            <strong>{waitlist.queueLength}</strong>
            <span>{t("waitlist.seatsNeeded")}</span>
            <strong>{waitlist.seatsRequired}</strong>
            <span>{t("waitlist.seatsFree")}</span>
            <strong>{waitlist.seatsAvailable}</strong>
          </>
        )}
      </div>

      <div className="button-row">
        {waitlist.state === "CONFIRMED" && (
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate(`/confirmation/${booking._id}`)}
          >
            {t("waitlist.viewTicket")}
          </button>
        )}
        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate(`/pnr?pnr=${booking.pnr}`)}
        >
          {waiting ? t("waitlist.manage") : t("confirm.manage")}
        </button>
      </div>
    </article>
  );
}

// BL-14 / UC-07: the waitlist section. Lists the passenger's waitlisted tickets with their
// live position, refreshes itself, and can check a single PNR.
export default function WaitlistPage({ initialPnr = "" }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const [pnr, setPnr] = useState(initialPnr);
  const [checked, setChecked] = useState(null);
  const [checkError, setCheckError] = useState("");
  const [checking, setChecking] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const data = await request(`${API}/waitlist`);
      setItems(data.items || []);
      setListError("");
      setUpdatedAt(new Date());
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPnr = useCallback(
    async (value) => {
      setChecked(null);
      setCheckError("");

      if (!/^[1-9]\d{9}$/.test(value)) {
        setCheckError(t("waitlist.invalidPnr"));
        return;
      }

      setChecking(true);
      try {
        setChecked(await request(`${API}/waitlist/${encodeURIComponent(value)}`));
      } catch (err) {
        setCheckError(err.message);
      } finally {
        setChecking(false);
      }
    },
    [t]
  );

  // Load now and keep the list fresh while the page is open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList();
    const timer = setInterval(loadList, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadList]);

  // Opened from a ticket (?pnr=...): show that ticket's status straight away.
  useEffect(() => {
    if (initialPnr) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      checkPnr(initialPnr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event) {
    event.preventDefault();
    checkPnr(pnr.trim());
  }

  return (
    <section className="content-section lookup-section waitlist-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("waitlist.eyebrow")}</p>
          <h2>{t("waitlist.title")}</h2>
        </div>
      </div>
      <p className="form-hint waitlist-intro">{t("waitlist.intro")}</p>

      <form className="lookup-form" onSubmit={submit}>
        <label>
          {t("waitlist.pnrLabel")}
          <input
            value={pnr}
            onChange={(e) => setPnr(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder={t("waitlist.pnrPlaceholder")}
            required
          />
        </label>
        <button type="submit" disabled={checking}>
          {checking ? t("waitlist.checking") : t("waitlist.check")}
        </button>
      </form>

      {checkError && <div className="alert error" role="alert">{checkError}</div>}

      {checked && (
        <div className="waitlist-checked">
          <h3>{t("waitlist.checkedTitle")}</h3>
          <WaitlistCard item={checked} highlight />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setChecked(null);
              setPnr("");
            }}
          >
            {t("waitlist.clearResult")}
          </button>
        </div>
      )}

      <div className="section-heading waitlist-list-heading">
        <h3>{t("waitlist.yourTickets")}</h3>
        <div className="waitlist-refresh">
          {updatedAt && (
            <span>{t("waitlist.updated", { time: updatedAt.toLocaleTimeString(lang) })}</span>
          )}
          <button type="button" className="secondary-button" onClick={loadList}>
            {t("waitlist.refresh")}
          </button>
        </div>
      </div>

      {listError && <div className="alert error" role="alert">{listError}</div>}

      {loading ? (
        <div className="empty-state" role="status">
          <div className="spinner" aria-hidden="true" />
          <p>{t("waitlist.loading")}</p>
        </div>
      ) : items.length === 0 && !listError ? (
        <div className="empty-state">
          <h3>{t("waitlist.emptyTitle")}</h3>
          <p>{t("waitlist.emptyText")}</p>
        </div>
      ) : (
        <div className="waitlist-list" aria-live="polite">
          {items.map((item) => (
            <WaitlistCard key={item.booking._id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
