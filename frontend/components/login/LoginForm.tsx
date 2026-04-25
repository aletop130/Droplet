"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { getMockCredentials, validateCredentials } from "@/lib/mockAuth"
import { useSessionStore } from "@/store/sessionStore"

export function LoginForm() {
  const router = useRouter()
  const signIn = useSessionStore((state) => state.signIn)
  const demoCredentials = getMockCredentials()
  const [username, setUsername] = useState(demoCredentials.username)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateCredentials(username, password)) {
      setError(true)
      return
    }
    signIn(username)
    router.replace("/app/map")
  }

  return (
    <GlassCard className={`rounded-[2rem] p-6 ${error ? "animate-[shake_180ms_ease-in-out_2]" : ""}`}>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[rgba(10,92,168,0.14)] bg-[rgba(255,255,255,0.62)]">
          <Image src="/droplet-mark.svg" alt="" width={29} height={29} priority />
        </div>
        <div>
          <Image src="/droplet-logo.svg" alt="Droplet" width={164} height={35} priority className="h-7 w-auto" />
          <div className="text-sm text-[var(--text-md)]">Operator access</div>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm text-[var(--text-md)]">
          Username
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={demoCredentials.username} />
        </label>
        <label className="grid gap-2 text-sm text-[var(--text-md)]">
          Password
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="droplet-2026"
              className="pr-20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-1.5 right-1.5 rounded-xl border border-[rgba(173,218,255,0.14)] px-3 text-xs font-medium uppercase tracking-[0.16em] text-[var(--acea-cyan)] transition hover:border-[rgba(75,214,255,0.35)] hover:bg-[rgba(75,214,255,0.08)]"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {error ? (
          <div className="rounded-2xl border border-[rgba(244,63,94,0.28)] bg-[rgba(244,63,94,0.08)] px-4 py-3 text-sm text-[var(--phi-red)]">
            Invalid credentials
          </div>
        ) : null}
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-4 text-center text-sm text-[var(--text-lo)]">Demo: {demoCredentials.username} · {demoCredentials.password}</div>
    </GlassCard>
  )
}
