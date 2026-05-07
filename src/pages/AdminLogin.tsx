import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/dashboard/BrandMark";

export default function AdminLogin() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    navigate("/admin", { replace: true });
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/admin", { replace: true });
  };

  return (
    <div className="bg-vault-pattern relative flex h-full w-full items-center justify-center overflow-hidden">
      <form
        onSubmit={onSubmit}
        className="vault-card relative w-full max-w-sm p-8"
        noValidate
      >
        <div className="mb-6 flex justify-center">
          <BrandMark size={88} showWordmark />
        </div>
        <h1 className="mb-6 text-center font-display text-2xl uppercase tracking-widest text-cyan-glow">
          Admin Console
        </h1>

        <div className="mb-4">
          <label htmlFor="login-email" className="field-label" data-required="true">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            className="field-input"
          />
        </div>

        <div className="mb-5">
          <label htmlFor="login-password" className="field-label" data-required="true">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            className="field-input"
          />
        </div>

        {error && (
          <p className="field-error mb-3" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary w-full"
        >
          {submitting ? "Signing in…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
