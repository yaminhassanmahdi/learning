import { Geist, Geist_Mono, Mulish } from "next/font/google";
import "./globals.css";
import { Providers } from '../app/components/provider'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const mulish = Mulish({ weight: '400', subsets: ['latin'] });
export const metadata = {
  title: "Learningly",
  description: "Yo",
};
import { Toaster } from "@/components/ui/sonner"
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${mulish.className} fade-inn bg-slate-200`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
