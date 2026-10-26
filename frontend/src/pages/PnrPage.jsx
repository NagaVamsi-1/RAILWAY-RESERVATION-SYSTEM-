import PnrLookup from "../components/PnrLookup";

export default function PnrPage({ initialPnr }) {
  // key resets the lookup when a different PNR is passed in via the URL
  return <PnrLookup key={initialPnr || "blank"} initialPnr={initialPnr} />;
}
