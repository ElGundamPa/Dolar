import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="bg-vault-pattern flex h-full w-full flex-col items-center justify-center">
      <p className="font-display text-7xl uppercase tracking-widest text-cyan-glow">
        404
      </p>
      <p className="mt-2 text-sm uppercase tracking-widest text-vault-silver/70">
        Vault sealed — this hand was never dealt
      </p>
      <Link
        to="/"
        className="btn btn-primary mt-8 px-6 py-2 text-sm uppercase tracking-widest"
      >
        Back to floor
      </Link>
    </div>
  );
}
