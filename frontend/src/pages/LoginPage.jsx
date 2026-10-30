
import { useState } from "react";
import { API, request } from "../api";
import "./RegisterPage.css";
import { navigate } from "../router";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const data = await request(`${API}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      sessionStorage.setItem("authToken", data.token);
      sessionStorage.setItem("authUser", JSON.stringify(data.user));

      window.dispatchEvent(new Event("auth-change"));

      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-section registration-page">
      <h1>Login</h1>
      <p>Sign in to your Railway Reservation account.</p>

      <form className="registration-form" onSubmit={handleSubmit}>
        <p>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </p>

        <p>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </p>

        <button
          className="registration-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
