"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { validateCredentials } from "@/lib/mockAuth"
import { useSessionStore } from "@/store/sessionStore"

export function LoginForm() {
  const router = useRouter()
  const signIn = useSessionStore((state) => state.signIn)
  const [username, setUsername] = useState("operator")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateCredentials(username, password)) {
      setError(true)
      return
    }
    signIn(username)
    router.replace("/app")
  }

  return (
    <GlassCard className={`rounded-[2rem] p-6 ${error ? "animate-[shake_180ms_ease-in-out_2]" : ""}`}>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[rgba(75,214,255,0.2)] bg-[rgba(255,255,255,0.03)]">
          <Image src="/droplet-mark.svg" alt="Droplet" width={28} height={28} priority />
        </div>
        <div>
          <div className="text-display text-lg font-semibold text-[var(--acea-ice)]">Droplet</div>
          <div className="text-sm text-[var(--text-md)]">Operator access</div>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm text-[var(--text-md)]">
          Username
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="operator" />
        </label>
        <label className="grid gap-2 text-sm text-[var(--text-md)]">
          Password
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="droplet-2026" />
        </label>
        {error ? (
          <div className="rounded-2xl border border-[rgba(244,63,94,0.28)] bg-[rgba(244,63,94,0.08)] px-4 py-3 text-sm text-[var(--phi-red)]">
            Credenziali non valide
          </div>
        ) : null}
        <Button type="submit" className="w-full">
          Entra
        </Button>
      </form>

      <div className="mt-4 text-center text-sm text-[var(--text-lo)]">Demo: operator · droplet-2026</div>
    </GlassCard>
  )
}
