import type { Metadata } from "next";

import { CaladronaLandingPage } from "../components/landing-page";
import "./caladrona.css";

export const metadata: Metadata = {
  description:
    "Operational intelligence that turns field messages, photos, voice notes, and documents into grounded decisions.",
  title: "Caladrona | Operational Intelligence"
};

export default function HomePage() {
  return <CaladronaLandingPage />;
}
