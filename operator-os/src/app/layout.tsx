import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Operator OS",
  description: "Recursive self-improvement operator platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <nav className="nav">
            <span className="brand">⛭ OPERATOR OS</span>
            <a href="/">cockpit</a>
            <a href="/evals">evals</a>
            <a href="/loop">loop</a>
            <a href="/skills">skills</a>
            <a href="/audit">audit</a>
            <a href="/owner">owner</a>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
