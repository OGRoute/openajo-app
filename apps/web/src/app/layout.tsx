import type { Metadata } from "next";
import Link from "next/link";
import "../styles/globals.css";
import WalletButton from "../components/WalletButton";

export const metadata: Metadata = {
  title: "OpenAjo — rotating savings on Stellar",
  description:
    "Ajo / esusu / adashe savings circles enforced by a Soroban smart contract instead of a collector you have to trust.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="top" aria-label="Main">
          <Link href="/"><strong>OpenAjo</strong></Link>
          <Link href="/circles">Circles</Link>
          <Link href="/circles/new">Start a circle</Link>
          <span className="spacer" />
          <WalletButton />
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
