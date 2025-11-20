import { Inter } from "next/font/google";
import "./globals.css"; 
const inter = Inter({ subsets: ["latin"] });
export const metadata = {
  title: "Cloud IDE Project",
  description: "Cloud IDE Project for my Portfolio",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}