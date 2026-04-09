"use client"

import { AppShell } from "@/components/app-shell"

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}