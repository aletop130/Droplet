import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google"
import "maplibre-gl/dist/maplibre-gl.css"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
})

const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-unbounded",
  display: "swap"
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap"
})

export const metadata: Metadata = {
  title: "Droplet",
  description: "Satellite and hydraulic intelligence for traceable water-network operations."
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${unbounded.variable} ${jetbrains.variable} dark`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
