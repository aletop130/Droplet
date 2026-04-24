"use client"

import { FormEvent, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { createSession, validateCredentials } from "@/lib/mockAuth"

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState("operator")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateCredentials(username, password)) {
      setError(true)
      return
    }
    createSession(username)
    router.replace("/app")
  }

  return (
    <GlassCard className={`w-full max-w-md p-6 ${error ? "animate-[shake_180ms_ease-in-out_2]" : ""}`}>
      <div className="mb-7 flex items-center gap-3">
        <Image src="/droplet-mark.svg" alt="Droplet" width={44} height={44} priority />
        <div>
          <h1 className="font-[var(--font-unbounded)] text-xl font-semibold tracking-normal">Droplet</h1>
          <p className="mt-1 text-sm text-[var(--text-md)]">Operator access</p>
        </div>
      </div>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm text-[var(--text-md)]">
          Username
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="operator" />
        </label>
        <label className="grid gap-2 text-sm text-[var(--text-md)]">
          Password
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••"
          />
        </label>
        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-[rgba(244,63,94,0.28)] bg-[rgba(244,63,94,0.08)] px-3 py-2 text-sm text-[var(--phi-red)]">
            <AlertTriangle className="h-4 w-4" />
            Invalid credentials.
          </div>
        ) : null}
        <Button type="submit" className="mt-1 w-full">
          Sign in
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-[var(--text-lo)]">
        Demo credentials · operator · droplet-2026
      </p>
    </GlassCard>
  )
}
