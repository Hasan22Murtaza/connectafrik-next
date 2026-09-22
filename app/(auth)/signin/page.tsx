"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Lock } from '@/shared/icons';
import { supabase } from "@/lib/supabase";
import { apiClient, ApiError } from "@/lib/api-client";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { savePendingLogin } from "@/lib/auth/clientStorage";
import toast from "react-hot-toast";
import { FcGoogle } from "react-icons/fc";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Caveat } from "next/font/google";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const PAGE_BG = "#FBF6EF";

const CribsTalkBrand = ({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) => {
  const heightClass =
    size === "lg" ? "h-12" : size === "sm" ? "h-9" : "h-10";

  return (
    <img
      src="/assets/images/logo_2.png"
      alt="CribsTalk"
      className={`${heightClass} w-auto object-contain`}
      draggable={false}
    />
  );
};

const inputClassName =
  "w-full h-12 rounded-xl border border-[#E5E7EB] bg-white pl-11 pr-4 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-shadow focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20";

const SigninForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "link_expired") {
      toast.error("This confirmation link is invalid or has expired. Sign up again or request a new link.");
      return;
    }
    if (error === "auth") {
      toast.error("Sign-in link failed. Please try again.");
    }
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const redirectTo = searchParams.get("redirect") || "/feed";
      // OAuth PKCE verifier cookies are host-scoped, so the callback must use the
      // same origin the user started from (www vs apex). Universal/App Links still
      // work because both hosts serve /auth/callback.
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("redirect", redirectTo);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        toast.error(error.message);
        setIsGoogleLoading(false);
      }
    } catch {
      toast.error("Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    try {
      if (loginMethod === "email") {
        const data = await apiClient.post<{
          user: any;
          session: { access_token: string; refresh_token: string } | null;
          platform_role?: string | null;
        }>("/api/auth/signin", {
          email: formData.email,
          password: formData.password,
        });
        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          toast.error("Sign in succeeded, but no session was returned.");
          setIsLoading(false);
          return;
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (setSessionError) {
          toast.error(setSessionError.message);
          setIsLoading(false);
          return;
        }

        toast.success("Welcome back!");
        const redirectTo = getPostAuthRedirect(
          data.platform_role,
          searchParams.get("redirect")
        );
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 200);
      } else {
        // Phone/OTP login
        const cleanPhone = formData.phone.trim();

        // Validate phone format (should start with + for international)
        if (!cleanPhone || !cleanPhone.startsWith("+")) {
          toast.error(
            "Phone number must include country code (e.g., +1234567890)"
          );
          setIsLoading(false);
          return;
        }

        // Send OTP via Supabase Phone Auth
        try {
          await apiClient.post<{ sent: boolean }>("/api/auth/send-otp", {
            phone: cleanPhone,
          });

          toast.success("Verification code sent to your phone!");
          router.push(
            `/verify-otp?phone=${encodeURIComponent(
              cleanPhone
            )}&redirect=${encodeURIComponent(
              searchParams.get("redirect") || "/feed"
            )}`
          );
        } catch (error: any) {
          console.error("Phone OTP error:", error);
          if (
            error.message?.includes("Invalid phone") ||
            error.message?.includes("invalid phone")
          ) {
            toast.error(
              "Please enter a valid phone number with country code (e.g., +1234567890)"
            );
          } else if (error.message?.includes("rate limit")) {
            toast.error(
              "Too many attempts. Please wait a moment and try again."
            );
          } else if (error.message?.includes("Phone Provider not enabled")) {
            toast.error(
              "Phone authentication is not enabled. Please use email signin or contact support."
            );
          } else if (
            error.message?.includes("not found") ||
            error.message?.includes("does not exist")
          ) {
            toast.error(
              "No account found with this phone number. Please sign up first."
            );
          } else {
            const errorMsg =
              error.message || "Failed to send verification code";
            toast.error(errorMsg);
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 403) {
        const details = error.details as { data?: { code?: string; email?: string } } | undefined
        const code = details?.data?.code
        if (code === 'TWO_FACTOR_REQUIRED' && loginMethod === 'email') {
          savePendingLogin({
            email: formData.email,
            password: formData.password,
          })
          toast.success('Enter the verification code we sent to your email.')
          router.push(
            `/verify-otp?email=${encodeURIComponent(formData.email)}&purpose=two_factor&redirect=${encodeURIComponent(searchParams.get('redirect') || '/feed')}`
          )
          setIsLoading(false)
          return
        }
        if (code === 'EMAIL_NOT_VERIFIED' && loginMethod === 'email') {
          try {
            savePendingLogin({
              email: formData.email,
              password: formData.password,
            })
            await apiClient.post<{ sent: boolean }>('/api/auth/send-email-otp', {
              email: formData.email,
              purpose: 'login',
            })
            toast.success('Please verify your email to continue.')
            router.push(
              `/verify-otp?email=${encodeURIComponent(formData.email)}&purpose=login&redirect=${encodeURIComponent(searchParams.get('redirect') || '/feed')}`
            )
          } catch (otpError: unknown) {
            const message =
              otpError instanceof Error ? otpError.message : 'Failed to send verification code'
            toast.error(message)
          }
          setIsLoading(false)
          return
        }
      }

      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error(message)
      setIsLoading(false)
    }
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="relative mx-auto grid min-h-screen w-full max-w-[1500px] grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <section className="relative hidden min-w-0 lg:flex lg:h-screen lg:items-center lg:overflow-hidden lg:pl-4 xl:pl-8">
          <Link
            href="/"
            className="absolute left-4 top-6 z-20 inline-flex xl:left-6"
            aria-label="CribsTalk home"
          >
            <CribsTalkBrand size="lg" />
          </Link>
          <div className="relative mx-auto h-full w-full max-w-[760px]">
            <img
              src="/assets/images/signin-promo-illustration.png"
              alt="People connecting around a shared cultural home on CribsTalk"
              className="h-full w-full object-contain object-center select-none"
              draggable={false}
            />
            <div
              className={`pointer-events-none absolute inset-0 hidden ${caveat.className} xl:block`}
              aria-hidden="true"
            >
              <p className="absolute left-[32%] top-[11%] -rotate-[8deg] text-[1.35rem] font-bold leading-tight text-[#3F2A14]">
                Our Crib, Our Culture,
                <br />
                Our Roots.
              </p>
              <p className="absolute right-[6%] top-[36%] max-w-[7.5rem] text-right text-[1.35rem] font-bold leading-snug text-[#1A1A1A]">
                Connect
                <br />
                Share
                <br />
                Belong
              </p>
              <div className="absolute bottom-[16%] left-[4%] max-w-[230px] rounded-[28px] rounded-br-md bg-[#16A34A] px-5 py-3 text-white shadow-md">
                <p className="text-[1.15rem] font-bold leading-tight">
                  Our environment, Our Story
                  <br />
                  Our talk, Our Platform.
                </p>
              </div>
              <p className="absolute bottom-[10%] left-[10%] text-base italic text-[#1A1A1A]">
                Strength in Our talk
              </p>
              <div className="absolute bottom-[22%] right-[3%] max-w-[140px] rotate-[8deg] rounded-[40%_60%_50%_50%] bg-[#F97316] px-4 py-3 text-center text-[13px] font-semibold leading-snug text-white">
                Our welcoming platform to the world
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen min-w-0 w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-5 lg:h-screen lg:overflow-y-auto lg:px-5 lg:py-8">
          <div className="w-full max-w-[420px]">
            <div className="rounded-[28px] border border-black/[0.06] bg-white px-5 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.08)] sm:px-8 sm:py-10">
             

              <div className="mb-6 text-center">
                <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-tight text-[#111827] sm:text-[1.85rem]">
                  Welcome back <span aria-hidden="true">👋</span>
                </h1>
               
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
                className="flex h-12 w-full min-h-12 items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FcGoogle className="h-5 w-5" />
                {isGoogleLoading ? "Redirecting..." : "Continue with Google"}
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E7EB]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#9CA3AF]">or</span>
                </div>
              </div>

              

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {loginMethod === "email" ? (
                  <>
                    <div>
                      <label htmlFor="email" className="sr-only">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className={inputClassName}
                          placeholder="Enter your email address"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className="sr-only">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          value={formData.password}
                          onChange={handleInputChange}
                          className={`${inputClassName} pr-11`}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#9CA3AF] hover:text-[#6B7280]"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center">
                        <input
                          id="remember-me"
                          name="remember-me"
                          type="checkbox"
                          className="h-4 w-4 rounded border-[#D1D5DB] text-[#22C55E] focus:ring-[#22C55E]"
                        />
                        <label
                          htmlFor="remember-me"
                          className="ml-2 block text-sm text-[#4B5563]"
                        >
                          Remember me
                        </label>
                      </div>
                      <div className="text-sm">
                        <Link
                          href="/forgot-password"
                          className="font-medium text-[#22C55E] hover:text-[#16A34A]"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="phone" className="sr-only">
                        Phone Number
                      </label>
                      <div className="[&_.PhoneInput]:flex [&_.PhoneInput]:h-12 [&_.PhoneInput]:items-center [&_.PhoneInput]:rounded-xl [&_.PhoneInput]:border [&_.PhoneInput]:border-[#E5E7EB] [&_.PhoneInput]:bg-white [&_.PhoneInput]:px-3 [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:text-[#111827] [&_.PhoneInputInput]:placeholder:text-[#9CA3AF] [&_.PhoneInputInput]:focus:outline-none [&_.PhoneInputInput]:focus:ring-0 [&_.PhoneInputCountry]:mr-2 [&_.PhoneInput]:focus-within:border-[#F97316] [&_.PhoneInput]:focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.2)]">
                        <PhoneInput
                          international
                          defaultCountry="GH"
                          value={formData.phone}
                          onChange={(value) =>
                            setFormData((prev) => ({ ...prev, phone: value || "" }))
                          }
                          placeholder="Enter your phone number"
                          numberInputProps={{ required: true, id: "phone" }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-[#6B7280]">
                        We'll send you a verification code via SMS
                      </p>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#F97316] text-sm font-semibold text-white transition-colors hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
                >
                  {isLoading ? (
                    "Signing In..."
                  ) : (
                    <>
                      Sign In <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-[#6B7280]">
                New to Cribstalk?
              </p>

              <Link
                href="/signup"
                className="mt-3 flex h-12 min-h-12 w-full items-center justify-center rounded-full border-2 border-[#22C55E] bg-white text-sm font-semibold text-[#22C55E] transition-colors hover:bg-[#F0FDF4] sm:text-base"
              >
                Create account
              </Link>

              <p className="mt-5 text-center text-[11px] leading-relaxed text-[#9CA3AF]">
                By continuing, you agree to our{" "}
                <Link
                  href="/terms-of-service"
                  className="underline decoration-[#D1D5DB] underline-offset-2 hover:text-[#6B7280]"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy-policy"
                  className="underline decoration-[#D1D5DB] underline-offset-2 hover:text-[#6B7280]"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const Signin: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ backgroundColor: PAGE_BG }}
        >
          <div className="text-center">
            <p className="text-sm text-[#6B7280]">Loading...</p>
          </div>
        </div>
      }
    >
      <SigninForm />
    </Suspense>
  );
};

export default Signin;
