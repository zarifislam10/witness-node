import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Witness-Node Command Center",
  description: "Live incident feed from deployed Witness-Node beacons.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
