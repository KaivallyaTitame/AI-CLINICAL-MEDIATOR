import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Clinical Mediator",
  description: "Evidence-based multi-agent debate workspace for hospital MDTs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-slate-50 text-slate-900 antialiased`}>
        <Providers>
          <div className="min-h-screen bg-[#f2f4f8]">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
