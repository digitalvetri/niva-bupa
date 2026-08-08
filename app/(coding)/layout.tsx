import { CodingProvider } from "@/components/coding/provider";
import { CodingShell } from "@/components/coding/shell";

export default function CodingLayout({ children }: { children: React.ReactNode }) {
  return (
    <CodingProvider>
      <CodingShell>{children}</CodingShell>
    </CodingProvider>
  );
}
