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
      <AuthForm mode="login" next={next} />
      <GoogleSignIn next={next} />
    </>
  );
}
