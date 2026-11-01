
import LanguageSelector from "./LanguageSelector";
import { useI18n } from "../i18n/useI18n";

const STEP_KEYS = [
  "steps.search",
  "steps.passengers",
  "steps.payment",
  "steps.confirmation",
];

export function Header({ path, onLogout }) {
  const { t } = useI18n();
  const isLoggedIn = Boolean(sessionStorage.getItem("authToken"));

  const onSearch = path === "/";
  const onPnr = path.startsWith("/pnr");
  const onWaitlist = path.startsWith("/waitlist");

  return (
    <header className="site-header">
      <a href="#/" className="brand" aria-label={t("brand.home")}>
        <div className="brand-mark" aria-hidden="true">🚆</div>
        <div>
          <span className="brand-title">{t("brand.title")}</span>
          <p>{t("brand.tagline")}</p>
        </div>
      </a>

      <div className="header-actions">
        <LanguageSelector />

        {isLoggedIn && (
          <nav className="main-nav" aria-label={t("nav.main")}>
            <a
              href="#/"
              className={onSearch ? "active" : ""}
              aria-current={onSearch ? "page" : undefined}
            >
              {t("nav.search")}
            </a>

            <a
              href="#/pnr"
              className={onPnr ? "active" : ""}
              aria-current={onPnr ? "page" : undefined}
            >
              {t("nav.pnr")}
            </a>

            <a
              href="#/waitlist"
              className={onWaitlist ? "active" : ""}
              aria-current={onWaitlist ? "page" : undefined}
            >
              {t("nav.waitlist")}
            </a>

            <button
              type="button"
              className="logout-button"
              onClick={onLogout}
            >
              {t("nav.logout")}
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}

export function ProgressSteps({ current }) {
  const { t } = useI18n();

  return (
    <ol className="progress-steps" aria-label={t("steps.aria")}>
      {STEP_KEYS.map((key, index) => (
        <li
          key={key}
          className={
            index < current ? "done" : index === current ? "current" : ""
          }
          aria-current={index === current ? "step" : undefined}
        >
          <span className="step-dot">
            {index < current ? "✓" : index + 1}
          </span>
          <span className="step-label">{t(key)}</span>
        </li>
      ))}
    </ol>
  );
}
