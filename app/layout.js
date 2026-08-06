import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: {
    default: "Go Gulf — Go Gulf. Get Hired.",
    template: "%s — Go Gulf",
  },
  description:
    "Go Gulf is a modern overseas recruitment platform connecting talented professionals with verified Gulf employers across Saudi Arabia, UAE, Qatar, Oman, Kuwait and Bahrain.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
