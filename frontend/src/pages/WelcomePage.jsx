
import { navigate } from "../router";
import { useI18n } from "../i18n/useI18n";
import "./WelcomePage.css";

export default function WelcomePage() {
  const { t } = useI18n();

  return (
    <section className="welcome-page">
      <div className="welcome-card">
        <div className="welcome-icon">🚆</div>

        <p className="welcome-eyebrow">{t("welcome.eyebrow")}</p>

        <h1>{t("welcome.title")}</h1>

        <p className="welcome-description">{t("welcome.description")}</p>

        <div className="welcome-actions">
          <button
            className="welcome-login-button"
            onClick={() => navigate("/login")}
          >
            {t("welcome.login")}
          </button>

          <button
            className="welcome-register-button"
            onClick={() => navigate("/register")}
          >
            {t("welcome.register")}
          </button>
        </div>

        <p className="welcome-footer">{t("welcome.footer")}</p>
      </div>
    </section>
  );
}
