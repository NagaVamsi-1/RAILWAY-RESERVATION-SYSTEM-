
import { useState } from "react";
import { API, request } from "../api";
import { navigate } from "../router";
import { useI18n } from "../i18n/useI18n";
import "./RegisterPage.css";

export default function RegisterPage() {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (form.password !== form.confirmPassword) {
      setError(t("register.mismatch"));
      return;
    }

    setLoading(true);

    try {
      const data = await request(`${API}/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      setMessage(data.message || t("register.success"));

      // Registration succeeded. Continue to Login.
      navigate("/login");
    } catch (err) {
      setError(err.message || t("register.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-section registration-page">
      <h1>{t("register.title")}</h1>
      <p>{t("register.subtitle")}</p>

      <form className="registration-form" onSubmit={handleSubmit}>
        <p>
          <label htmlFor="register-name">{t("register.name")}</label>
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            maxLength={100}
            required
          />
        </p>

        <p>
          <label htmlFor="register-email">{t("register.email")}</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            maxLength={254}
            required
          />
        </p>

        <p>
          <label htmlFor="register-password">{t("register.password")}</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            minLength={8}
            maxLength={72}
            required
          />
        </p>

        <p>
          <label htmlFor="register-confirm-password">
            {t("register.confirm")}
          </label>
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            minLength={8}
            maxLength={72}
            required
          />
        </p>

        <button
          className="registration-button"
          type="submit"
          disabled={loading}
        >
          {loading ? t("register.loading") : t("register.submit")}
        </button>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
