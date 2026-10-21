import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "FisioApp",
  description: "Gestão clínica para fisioterapia",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
