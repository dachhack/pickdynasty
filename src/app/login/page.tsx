import AuthForm from "@/components/AuthForm";
import GoogleSignIn from "@/components/GoogleSignIn";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <>
      {error === "oauth" && (
        <p className="mx-auto mt-8 w-full max-w-sm rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          Google sign-in didn&rsquo;t complete — try again or use email.
        </p>
      )}
      {error === "unavailable" && (
        <p className="mx-auto mt-8 w-full max-w-sm rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          Sign-in is temporarily unavailable — this is on us, not your
          password. Try again shortly.
        </p>
      )}
      {error === "confirm" && (
        <p className="mx-auto mt-8 w-full max-w-sm rounded-lg border border-red-900 bg-red-950/50 px-4 py-2 text-sm text-red-300">
          That confirmation link expired or was already used — log in, or sign up
          again to get a fresh one.
        </p>
      )}
      <AuthForm mode="login" next={next} />
      <GoogleSignIn next={next} />
    </>
  );
}
