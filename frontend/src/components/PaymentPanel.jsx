import { useEffect, useRef, useState } from "react";
import { API, request, formatMoney } from "../api";
import "./payment.css";

// BL-11 – Online payment for a booking that is waiting in PENDING_PAYMENT (UC-04).
export default function PaymentPanel({ booking, onPaid, onExpired, onSearchAgain }) {
  const [method, setMethod] = useState("UPI");
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState({ cardNumber: "", cardHolder: "", expiry: "", cvv: "" });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false); // blocks repeated submissions while a payment is processing

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const msLeft = booking.holdExpiresAt
    ? new Date(booking.holdExpiresAt).getTime() - now
    : Infinity;
  const expired = msLeft <= 0;
  const minutes = Math.max(0, Math.floor(msLeft / 60000));
  const seconds = Math.max(0, Math.floor((msLeft % 60000) / 1000));

  function updateCard(field, value) {
    setCard((current) => ({ ...current, [field]: value }));
  }

  function formatCardNumber(value) {
    return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(value) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  async function pay(event) {
    event.preventDefault();
    if (inFlight.current || expired) return;
    inFlight.current = true;
    setError("");
    setProcessing(true);

    try {
      const body = method === "UPI" ? { method, upiId: upiId.trim() } : { method, ...card };

      const data = await request(`${API}/bookings/${booking._id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      onPaid(data.booking, data.message);
    } catch (err) {
      setError(err.message);
      if (/expired/i.test(err.message)) onExpired?.();
    } finally {
      inFlight.current = false;
      setProcessing(false);
    }
  }

  return (
    <div className="payment-panel">
      <p className="eyebrow">PAYMENT</p>
      <h3>Complete payment to confirm your booking</h3>

      <div className="payment-summary">
        <div>
          <span>Fare per passenger</span>
          <strong>{formatMoney(booking.farePerPassenger)}</strong>
        </div>
        <div>
          <span>Passengers</span>
          <strong>{booking.seatCount}</strong>
        </div>
        <div className="payment-total">
          <span>Total payable</span>
          <strong>{formatMoney(booking.totalAmount)}</strong>
        </div>
      </div>

      <p className={`hold-timer ${msLeft < 60000 ? "urgent" : ""}`}>
        {expired
          ? "Your seat hold has expired. Please search and book again."
          : `Seats held for ${minutes}:${String(seconds).padStart(2, "0")}`}
      </p>
      {expired && onSearchAgain && (
        <button type="button" className="primary-button" onClick={onSearchAgain}>
          Search trains &amp; book again
        </button>
      )}

      <div className="method-tabs" role="tablist">
        {["UPI", "CARD"].map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={method === item}
            className={method === item ? "active" : ""}
            onClick={() => {
              setMethod(item);
              setError("");
            }}
          >
            {item === "UPI" ? "UPI" : "Credit / Debit card"}
          </button>
        ))}
      </div>

      <form className="payment-form" onSubmit={pay} aria-busy={processing}>
        {method === "UPI" ? (
          <label>
            UPI ID
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="name@bank"
              autoComplete="off"
              required
            />
          </label>
        ) : (
          <>
            <label>
              Card number
              <input
                inputMode="numeric"
                value={card.cardNumber}
                onChange={(e) => updateCard("cardNumber", formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Name on card
              <input
                value={card.cardHolder}
                onChange={(e) => updateCard("cardHolder", e.target.value)}
                placeholder="As printed on the card"
                autoComplete="off"
                required
              />
            </label>
            <div className="payment-row">
              <label>
                Expiry (MM/YY)
                <input
                  inputMode="numeric"
                  value={card.expiry}
                  onChange={(e) => updateCard("expiry", formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                CVV
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={3}
                  value={card.cvv}
                  onChange={(e) => updateCard("cvv", e.target.value.replace(/\D/g, ""))}
                  placeholder="•••"
                  autoComplete="off"
                  required
                />
              </label>
            </div>
          </>
        )}

        {error && <div className="alert error" role="alert">{error}</div>}
        {processing && <p className="form-hint" role="status">Processing payment — please do not refresh or close this page.</p>}

        <button className="primary-button" type="submit" disabled={processing || expired}>
          {processing ? "Processing payment..." : `Pay ${formatMoney(booking.totalAmount)}`}
        </button>

        <p className="form-hint">
          Payment details are sent securely to the payment service and are never stored by this
          system. Demo mode: a UPI ID ending in <code>@failbank</code> or card{" "}
          <code>4000 0000 0000 0002</code> is declined; any other valid details succeed.
        </p>
      </form>
    </div>
  );
}
