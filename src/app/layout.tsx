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
      <body className="min-h-screen font-[var(--font-inter)] relative overflow-x-hidden">
        {/* Background Blobs */}
        <div className="fixed -top-24 -left-24 w-96 h-96 bg-[#9b6dff]/10 rounded-full blur-[100px] -z-10" />
        <div className="fixed top-1/2 -right-24 w-80 h-80 bg-[#4adede]/10 rounded-full blur-[100px] -z-10" />

        {/* Top nav */}
        <header className="sticky top-0 z-40 bg-white/30 backdrop-blur-md border-b border-white/40">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9b6dff] to-[#76e4f7] flex items-center justify-center shadow-lg">
                <span className="text-sm font-black text-white tracking-tight">S</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800 tracking-wide leading-none">SENTINEL</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Dashboard</span>
              </div>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-white/50 border border-white/60 text-[10px] font-bold text-slate-500 hidden sm:block uppercase tracking-tight">
              Community Space Monitoring Only
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}

