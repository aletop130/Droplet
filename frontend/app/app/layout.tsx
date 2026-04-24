import { AppShell } from "@/components/shell/AppShell"

export default function PlatformLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AppShell>{children}</AppShell>
}
