
import { useEffect, useState } from "react";
import "./App.css";
import { Header } from "./components/Layout";
import { useRoute, navigate } from "./router";
import {
  clearSearch,
  emptySearch,
  loadSearch,
  saveSearch,
} from "./bookingFlow";

import SearchPage from "./pages/SearchPage";
import PassengerPage from "./pages/PassengerPage";
import PaymentPage from "./pages/PaymentPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import PnrPage from "./pages/PnrPage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import WelcomePage from "./pages/WelcomePage";

export default function App() {
  const { path, params } = useRoute();
  const [search, setSearch] = useState(loadSearch);
  const [authToken, setAuthToken] = useState(
    () => sessionStorage.getItem("authToken")
  );

  useEffect(() => {
    saveSearch(search);
  }, [search]);

  // Listen for successful login.
  useEffect(() => {
    function handleAuthChange() {
      setAuthToken(sessionStorage.getItem("authToken"));
    }

    window.addEventListener("auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, []);

  function handleLogout() {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");

    clearSearch();
    setSearch({ ...emptySearch });
    setAuthToken(null);

    navigate("/login");
  }

  function bookAnother() {
    clearSearch();
    setSearch({ ...emptySearch });
    navigate("/");
  }

  const isLoggedIn = Boolean(authToken);

  let page;

  const payment = path.match(/^\/payment\/([^/]+)$/);
  const confirmation = path.match(/^\/confirmation\/([^/]+)$/);

  if (path === "/register") {
    page = <RegisterPage />;
  } else if (path === "/login") {
    page = <LoginPage />;
  } else if (!isLoggedIn && path === "/") {
    page = <WelcomePage />;
  } else if (!isLoggedIn) {
    page = <LoginPage />;
  } else if (payment) {
    page = (
      <PaymentPage
        key={payment[1]}
        bookingId={payment[1]}
        onBookAgain={bookAnother}
      />
    );
  } else if (confirmation) {
    page = (
      <ConfirmationPage
        key={confirmation[1]}
        bookingId={confirmation[1]}
        onBookAgain={bookAnother}
      />
    );
  } else if (path === "/passengers") {
    page = <PassengerPage search={search} setSearch={setSearch} />;
  } else if (path === "/pnr") {
    page = <PnrPage initialPnr={params.get("pnr") || ""} />;
  } else {
    page = <SearchPage search={search} setSearch={setSearch} />;
  }

  const headerPath =
    !isLoggedIn && path !== "/register" && path !== "/login"
      ? "/login"
      : path;

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#/"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>

      <Header path={headerPath} onLogout={handleLogout} />

      <main id="main-content" tabIndex={-1}>
        {page}
      </main>

      <footer className="site-footer">
        Railway Reservation System · Academic project
      </footer>
    </div>
  );
}
