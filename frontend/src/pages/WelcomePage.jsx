
import { navigate } from "../router";
import "./WelcomePage.css";

export default function WelcomePage() {
  return (
    <section className="welcome-page">
      <div className="welcome-card">
        <div className="welcome-icon">🚆</div>

        <p className="welcome-eyebrow">RAILWAY RESERVATION SYSTEM</p>

        <h1>Welcome Aboard!</h1>

        <p className="welcome-description">
          Plan your journey, find trains, and manage your reservations
          in one place.
        </p>

        <div className="welcome-actions">
          <button
            className="welcome-login-button"
            onClick={() => navigate("/login")}
          >
            Login
          </button>

          <button
            className="welcome-register-button"
            onClick={() => navigate("/register")}
          >
            Create an Account
          </button>
        </div>

        <p className="welcome-footer">
          Your journey begins here.
        </p>
      </div>
    </section>
  );
}
