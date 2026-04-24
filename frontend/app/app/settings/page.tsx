"use client"

import { GlassCard } from "@/components/ui/GlassCard"
import { Settings, Shield, User } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
            Operator
          </p>
          <h1 className="mt-2 font-[var(--font-unbounded)] text-3xl font-semibold tracking-normal">
            Settings & Preferences
          </h1>
        </div>
      </section>

      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="h-5 w-5 text-[var(--acea-cyan)]" />
          <h2 className="font-[var(--font-unbounded)] text-lg">Profile</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-[var(--text-lo)]">Username</div>
            <div className="font-[var(--font-jetbrains)] text-[var(--text-md)]">operator</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-lo)]">Session</div>
            <div className="font-[var(--font-jetbrains)] text-[var(--text-md)]">Active</div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-[var(--acea-cyan)]" />
          <h2 className="font-[var(--font-unbounded)] text-lg">Security</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-md)]">AI Act Art. 13 Compliance</span>
            <span className="text-xs text-[var(--phi-green)]">✓ Enabled</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-md)]">Audit Logging</span>
            <span className="text-xs text-[var(--phi-green)]">✓ Active</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-5 w-5 text-[var(--acea-cyan)]" />
          <h2 className="font-[var(--font-unbounded)] text-lg">System</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-[var(--text-lo)]">Backend API</div>
            <div className="font-[var(--font-jetbrains)] text-[var(--acea-cyan)]">https://Alessandro0709-Droplet.hf.space</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-lo)]">Pilot Region</div>
            <div className="font-[var(--font-jetbrains)] text-[var(--text-md)]">Frosinone, Lazio (IT)</div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
