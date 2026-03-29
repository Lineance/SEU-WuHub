"use client"

import { AppShell } from "@/components/app-shell"

export default function CategoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
