import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rook — adversarial AI trading desk",
  description:
    "Rook is an AI trading desk that doesn't just build a thesis — it tries to destroy it before you put money behind it.",
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
