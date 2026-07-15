import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SENTINEL",
  description: "Old Age Home Monitoring — Common Areas Only",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-100 font-[var(--font-inter)]">
        {/* Top nav */}
        <header className="sticky top-0 z-30 bg-[#0f1f3d] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-xs font-black text-white tracking-tight">S</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-white tracking-wide">SENTINEL</span>
                <span className="text-xs text-slate-400 font-medium">Dashboard</span>
              </div>
            </div>
            <span className="text-xs text-slate-500 hidden sm:block">
              No In-Room Monitoring · Common Areas Only
            </span>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-5 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
