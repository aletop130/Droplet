import { LoginForm } from "@/components/login/LoginForm"

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  )
}
