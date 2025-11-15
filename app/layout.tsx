import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auditoria de PPP",
  description: "Sistema de Auditoria de Perfil Profissiográfico Previdenciário",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

