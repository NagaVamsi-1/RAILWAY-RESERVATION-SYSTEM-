
import { navigate } from "../router";

const STEPS = ["Train Search", "Passenger Details", "Payment", "Confirmation"];

export function Header({ path, onLogout }) {
  const isLoggedIn = Boolean(sessionStorage.getItem("authToken"));

  const onSearch = path === "/";
  const onPnr = path.startsWith("/pnr");

  return (
    <header className="site-header">
      <a href="#/" className="brand" aria-label="Railway Reservation home">
        <div className="brand-mark" aria-hidden="true">🚆</div>
        <div>
          <span className="brand-title">Railway Reservation</span>
          <p>Search. Reserve. Travel.</p>
        </div>
      </a>

      {isLoggedIn && (
        <nav className="main-nav" aria-label="Main">
          <a
            href="#/"
            className={onSearch ? "active" : ""}
            aria-current={onSearch ? "page" : undefined}
          >
            Search Trains
          </a>

          <a
            href="#/pnr"
            className={onPnr ? "active" : ""}
            aria-current={onPnr ? "page" : undefined}
          >
            PNR Lookup / Manage Booking
          </a>

          <button
            type="button"
            className="logout-button"
            onClick={onLogout}
          >
            Logout
          </button>
        </nav>
      )}
    </header>
  );
}

export function ProgressSteps({ current }) {
  return (
    <ol className="progress-steps" aria-label="Booking progress">
      {STEPS.map((label, index) => (
        <li
          key={label}
          className={
            index < current ? "done" : index === current ? "current" : ""
          }
          aria-current={index === current ? "step" : undefined}
        >
          <span className="step-dot">
            {index < current ? "✓" : index + 1}
          </span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
