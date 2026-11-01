import { useState } from "react";
import { API, request } from "../api";
import { ProgressSteps } from "../components/Layout";
import { navigate } from "../router";
import { getToday, trainKey } from "../bookingFlow";
import { useI18n } from "../i18n/useI18n";

const CITIES = [
  "Bengaluru",
  "Chennai",
  "Mumbai",
  "Delhi",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Mysuru",
  "Mangaluru",
  "Coimbatore",
  "Kochi",
  "Vijayawada",
  "Visakhapatnam",
];

export default function SearchPage({ search, setSearch }) {
  const { t, city, train: getTrainName } = useI18n();
  const { source, destination, date, trains, selectedTrain } = search;

  const [viewedKey, setViewedKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(trains.length > 0);
  const [error, setError] = useState("");

  const patch = (changes) =>
    setSearch((current) => ({ ...current, ...changes }));

  // Helper to resolve the localized train name using the i18n train helper
  const resolveTrainName = (item) => {
    if (!item) return t("search.nameUnavailable");
    const num = item.number || item.id;
    return getTrainName
      ? getTrainName(num, item.name)
      : item.name || t("search.nameUnavailable");
  };

  async function searchTrains(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    setViewedKey(null);

    if (source === destination) {
      setError(t("search.sameCity"));
      setLoading(false);
      setSearched(true);
      patch({ trains: [], selectedTrain: null, travelClass: "" });
      return;
    }

    try {
      const params = new URLSearchParams({
        source: source.trim(),
        destination: destination.trim(),
        date,
      });

      const data = await request(
        `${API}/trains/search?${params.toString()}`
      );

      patch({
        trains: data.trains || [],
        selectedTrain: null,
        travelClass: "",
      });
    } catch (err) {
      patch({ trains: [], selectedTrain: null, travelClass: "" });
      setError(err.message || t("search.failed"));
    } finally {
      setSearched(true);
      setLoading(false);
    }
  }

  function changeSource(value) {
    patch({
      source: value,
      ...(value === destination
        ? { destination: CITIES.find((item) => item !== value) || "" }
        : {}),
    });
  }

  function toggleDetails(key) {
    setViewedKey((current) => (current === key ? null : key));
  }

  function selectAndBook(event, selected, travelClass) {
    event.stopPropagation();
    patch({ selectedTrain: selected, travelClass });
    navigate("/passengers");
  }

  return (
    <>
      <ProgressSteps current={0} />

      <section className="hero">
        <p className="eyebrow">{t("search.eyebrow")}</p>
        <h2>{t("search.title")}</h2>
        <p>{t("search.intro")}</p>

        <form className="search-form" onSubmit={searchTrains}>
          <label>
            {t("search.from")}
            <select
              value={source}
              onChange={(event) => changeSource(event.target.value)}
              required
            >
              <option value="">{t("search.selectFrom")}</option>
              {CITIES.map((name) => (
                <option value={name} key={name}>
                  {city(name)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t("search.to")}
            <select
              value={destination}
              onChange={(event) => patch({ destination: event.target.value })}
              required
            >
              <option value="">{t("search.selectTo")}</option>
              {CITIES.map((name) => (
                <option
                  value={name}
                  key={name}
                  disabled={name === source}
                >
                  {city(name)}
                </option>
              ))}
            </select>
          </label>

          <label className="date-field">
            {t("search.date")}
            <span className="date-input-wrap">
              <input
                id="journey-date"
                type="date"
                value={date}
                min={getToday()}
                onChange={(event) => patch({ date: event.target.value })}
                required
              />

              <button
                className="calendar-button"
                type="button"
                aria-label={t("search.openCalendar")}
                onClick={(event) => {
                  event.stopPropagation();
                  const input = document.getElementById("journey-date");

                  if (input?.showPicker) {
                    input.showPicker();
                  } else {
                    input?.focus();
                    input?.click();
                  }
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                  <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
                </svg>
              </button>
            </span>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? t("search.searching") : t("search.submit")}
          </button>
        </form>
      </section>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      <section className="content-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("search.resultsEyebrow")}</p>
            <h2>{t("search.resultsTitle")}</h2>
          </div>

          <span className="result-count">
            {t("search.count", { count: trains.length })}
          </span>
        </div>

        {loading ? (
          <div className="empty-state" role="status">
            <div className="spinner" aria-hidden="true" />
            <p>{t("search.searchingTrains")}</p>
          </div>
        ) : trains.length === 0 ? (
          <div className="empty-state">
            <h3>
              {searched && !error
                ? t("search.noneFound")
                : t("search.noResults")}
            </h3>
            <p>
              {searched && !error
                ? t("search.noneFoundText")
                : t("search.noResultsText")}
            </p>
          </div>
        ) : (
          <div className="train-list">
            {trains.map((trainItem) => {
              const key = trainKey(trainItem);
              const isViewed = viewedKey === key;
              const isSelected = trainKey(selectedTrain) === key;
              const classes = trainItem.classes || [];
              const localizedName = resolveTrainName(trainItem);

              return (
                <article
                  className={`train-card clickable-train-card ${
                    isSelected ? "selected" : ""
                  }`}
                  key={key}
                  onClick={() => toggleDetails(key)}
                  onKeyDown={(event) => {
                    if (
                      event.target !== event.currentTarget ||
                      (event.key !== "Enter" && event.key !== " ")
                    ) {
                      return;
                    }

                    event.preventDefault();
                    toggleDetails(key);
                  }}
                  tabIndex={0}
                  aria-label={t(
                    isViewed ? "search.ariaHide" : "search.ariaView",
                    { name: localizedName }
                  )}
                >
                  <div className="train-main">
                    <div>
                      <span className="train-number">
                        {t("common.train", { number: trainItem.number || trainItem.id })}
                      </span>
                      <h3>{localizedName}</h3>
                    </div>

                    <button
                      className="secondary-button"
                      type="button"
                      aria-expanded={isViewed}
                      aria-controls={`details-${key}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleDetails(key);
                      }}
                    >
                      {isViewed ? t("search.hideDetails") : t("search.viewDetails")}
                    </button>
                  </div>

                  <div className="route-line">
                    <div>
                      <strong>{trainItem.departure || "--:--"}</strong>
                      <span>{city(trainItem.source || source)}</span>
                    </div>

                    <div className="route-duration">
                      <span>{trainItem.duration || t("search.durationUnavailable")}</span>
                      <div className="route-track" />
                    </div>

                    <div className="route-destination">
                      <strong>{trainItem.arrival || "--:--"}</strong>
                      <span>{city(trainItem.destination || destination)}</span>
                    </div>
                  </div>

                  <div className="details-class-section">
                    <h4>{t("search.availableClasses")}</h4>

                    {classes.length > 0 ? (
                      <div className="class-list">
                        {classes.map((item) => (
                          <span className="class-chip" key={item}>
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="detail-unavailable">
                        {t("search.classUnavailable")}
                      </p>
                    )}
                  </div>

                  {isViewed && (
                    <div className="train-details" id={`details-${key}`}>
                      <h4>{t("search.trainDetails")}</h4>

                      <div className="train-details-grid">
                        <p>
                          <strong>{t("search.trainNumber")}</strong>
                          <span>
                            {trainItem.number || trainItem.id || t("common.notAvailable")}
                          </span>
                        </p>
                        <p>
                          <strong>{t("search.trainName")}</strong>
                          <span>{localizedName}</span>
                        </p>
                        <p>
                          <strong>{t("search.origin")}</strong>
                          <span>
                            {trainItem.source ? city(trainItem.source) : t("common.notAvailable")}
                          </span>
                        </p>
                        <p>
                          <strong>{t("search.destination")}</strong>
                          <span>
                            {trainItem.destination
                              ? city(trainItem.destination)
                              : t("common.notAvailable")}
                          </span>
                        </p>
                        <p>
                          <strong>{t("search.departure")}</strong>
                          <span>{trainItem.departure || t("common.notAvailable")}</span>
                        </p>
                        <p>
                          <strong>{t("search.arrival")}</strong>
                          <span>{trainItem.arrival || t("common.notAvailable")}</span>
                        </p>
                        <p>
                          <strong>{t("search.duration")}</strong>
                          <span>{trainItem.duration || t("common.notAvailable")}</span>
                        </p>
                        <p>
                          <strong>{t("common.journeyDate")}</strong>
                          <span>{date || t("common.notAvailable")}</span>
                        </p>
                      </div>

                      <div className="details-class-section">
                        <h4>{t("search.chooseClass")}</h4>

                        {classes.length > 0 ? (
                          <div className="details-class-options">
                            {classes.map((item) => (
                              <div className="details-class-option" key={item}>
                                <div>
                                  <strong>{item}</strong>
                                  <span>{t("search.travelClass")}</span>
                                </div>

                                <button
                                  className="primary-button"
                                  type="button"
                                  onClick={(event) =>
                                    selectAndBook(event, trainItem, item)
                                  }
                                >
                                  {t("search.selectClass")}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="detail-unavailable">
                            {t("search.noClasses")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}