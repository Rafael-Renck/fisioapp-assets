import type { Metadata } from "next";
import "./styles.css";
import { AppShell } from "../components/app-shell";
import { PatientsProvider } from "../components/patients-provider";

export const metadata: Metadata = {
  title: "FisioApp",
  description: "Gestão clínica para fisioterapia",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><PatientsProvider><AppShell>{children}</AppShell></PatientsProvider></body></html>;
}
