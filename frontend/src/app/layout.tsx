import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrueVerdict | Anti-SEO Product Scout & Contradiction Resolver",
  description:
    "An adversarial multi-agent AI product scout powered by LangGraph. Uncovers real owner complaints on Reddit, cross-examines affiliate marketing claims, and resolves hidden product flaws.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#080c14] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        {children}
      </body>
    </html>
  );
}
