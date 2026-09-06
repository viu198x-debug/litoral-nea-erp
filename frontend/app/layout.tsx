import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LITORAL NEA | Ingeniería, obras y gestión integral",
  description:
    "Presentación institucional y acceso seguro al ERP de LITORAL NEA SRL para obras, ingeniería, administración y finanzas.",
  icons: { icon: "/assets/litoral-nea-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111820",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
