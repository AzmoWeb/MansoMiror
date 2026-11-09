import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-content-center py-24 text-center">
      <p className="font-mono text-sm text-subtle">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Cette page n'a pas de reflet.</h1>
      <Link href="/" className="btn btn-ghost mx-auto mt-8">Retour à l'accueil</Link>
    </div>
  );
}
