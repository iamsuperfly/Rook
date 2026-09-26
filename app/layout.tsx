import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rook — adversarial trading desk",
  description:
    "An adversarial trading desk for crypto markets. Build a thesis. Stress-test it. Define what proves it wrong. Define what proves it right.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#07080c",
          color: "#e8e4d8",
        }}
      >
        {children}
      </body>
    </html>
  );
}
