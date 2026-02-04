import Link from 'next/link';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-serif text-2xl italic text-kyar-text mb-2">Sign in</h1>
        <p className="text-kyar-textSecondary mb-6">Auth not implemented in this baseline.</p>
        <Link href="/" className="text-kyar-accent underline">Back to home</Link>
      </div>
    </div>
  );
}
