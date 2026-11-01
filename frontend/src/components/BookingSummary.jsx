import { formatMoney } from "../api";
import { useI18n } from "../i18n/useI18n";

export function StatusBadge({ status }) {
  const { t } = useI18n();
  const key = String(status || "").toLowerCase();
  const fallback = String(status || "").replace("_", " ");

  return (
    <span className={`status-badge ${key}`}>
      {t(`status.${status}`, undefined, fallback)}
    </span>
  );
}

export default function BookingSummary({ booking }) {
  const { t, city } = useI18n();

  return (
    <div className="journey-summary">
      <div className="journey-head">
        <div>
          <span className="train-number">
            {t("common.train", { number: booking.trainNumber })}
          </span>
          <h3>{booking.trainName}</h3>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="confirmation-details">
        <span>{t("common.route")}</span>
        <strong>{city(booking.source)} → {city(booking.destination)}</strong>
        <span>{t("common.journeyDate")}</span>
        <strong>
          {booking.journeyDate?.slice(0, 10)}
          {booking.departure ? ` · ${t("common.departs", { time: booking.departure })}` : ""}
        </strong>
        <span>{t("common.class")}</span>
        <strong>{booking.travelClass}</strong>
        <span>{t("common.passengers")}</span>
        <strong>{booking.seatCount}</strong>
        {booking.farePerPassenger != null && (
          <>
            <span>{t("summary.farePerPassenger")}</span>
            <strong>{formatMoney(booking.farePerPassenger)}</strong>
          </>
        )}
      </div>
    </div>
  );
}
