import Link from "next/link"

import { LoginForm } from "@/components/login/LoginForm"

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-md">
        <LoginForm />
        <div className="mt-5 text-center text-sm text-[var(--text-md)]">
          <Link href="/" className="hover:text-[var(--acea-cyan)]">
            Back to landing
          </Link>
        </div>
      </div>
    </main>
  )
}
