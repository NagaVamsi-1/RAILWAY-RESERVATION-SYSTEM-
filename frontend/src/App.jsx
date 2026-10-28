import { useEffect, useState } from "react";
import "./App.css";
import { Header } from "./components/Layout";
import { useRoute, navigate } from "./router";
import { clearSearch, emptySearch, loadSearch, saveSearch } from "./bookingFlow";
import SearchPage from "./pages/SearchPage";
import PassengerPage from "./pages/PassengerPage";
import PaymentPage from "./pages/PaymentPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import PnrPage from "./pages/PnrPage";
import RegisterPage from "./pages/RegisterPage";

export default function App() {
  const { path, params } = useRoute();
  const [search, setSearch] = useState(loadSearch);

  useEffect(() => {
    saveSearch(search);
  }, [search]);

  // Clears only the completed booking's frontend state and returns to a clean search screen.
  function bookAnother() {
    clearSearch();
    setSearch({ ...emptySearch });
    navigate("/");
  }

  let page;
  const payment = path.match(/^\/payment\/([^/]+)$/);
  const confirmation = path.match(/^\/confirmation\/([^/]+)$/);

if (path === "/register") {
    page = <RegisterPage />;
  } else if (payment) {
    page = <PaymentPage key={payment[1]} bookingId={payment[1]} onBookAgain={bookAnother} />;
  } else if (confirmation) {
    page = <ConfirmationPage key={confirmation[1]} bookingId={confirmation[1]} onBookAgain={bookAnother} />;
  } else if (path === "/passengers") {
    page = <PassengerPage search={search} setSearch={setSearch} />;
  } else if (path === "/pnr") {
    page = <PnrPage initialPnr={params.get("pnr") || ""} />;
  } else {
    page = <SearchPage search={search} setSearch={setSearch} />;
  }

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#/"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <Header path={path} />
      <main id="main-content" tabIndex={-1}>{page}</main>
      <footer className="site-footer">Railway Reservation System · Academic project</footer>
    </div>
  );
}
