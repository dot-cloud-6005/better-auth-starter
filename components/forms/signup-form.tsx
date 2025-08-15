"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Use client-side auth client instead of importing server actions

import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const requestSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
});
const verifySchema = z.object({
  code: z.string().length(6),
});

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [cooldown, setCooldown] = useState<number>(0);
  const RESEND_SECONDS = 30;

  const router = useRouter();
  const requestForm = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { username: "", email: "" },
    mode: "onChange",
  });
  const verifyForm = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
    mode: "onChange",
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  /* const signInWithGoogle = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/landing",
    });
  }; */

  async function submitRequest(values: z.infer<typeof requestSchema>) {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: values.email.trim(),
          name: values.username.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to send code");
      setEmail(values.email.trim());
      setName(values.username.trim());
      setStep("verify");
      setCooldown(RESEND_SECONDS);
      toast.success("We sent you a 6-digit code.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not send code";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function resendCode() {
    if (!email || cooldown > 0 || isLoading) return;
    await submitRequest({ email, username: name });
  }

  async function submitVerify(values: z.infer<typeof verifySchema>) {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const code = values.code.replace(/\D/g, "").slice(0, 6);
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code, name }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Invalid code");
      }
      toast.success("Signed up successfully.");
      router.push("/landing");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid code";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Sign-up with your Ventia email</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "request" ? (
            <Form {...requestForm}>
              <form
                onSubmit={requestForm.handleSubmit(submitRequest)}
                className="space-y-8"
              >
                <div className="grid gap-6">
                  
                  <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                    
                  </div>
                  <div className="grid gap-6">
                    <div className="grid gap-3">
                      <FormField
                        control={requestForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Jane Doe"
                                className="md:h-12 md:text-lg"
                                autoComplete="name"
                                autoFocus
                                {...field}
                                onChange={(e) =>
                                  field.onChange(e.target.value.replace(/\s{2,}/g, " "))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={requestForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                placeholder="@ventia.com"
                                className="md:h-12 md:text-lg"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.trimStart())}
                                onBlur={(e) => field.onChange(e.target.value.trim())}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full md:h-12 md:text-base"
                      disabled={isLoading || !requestForm.formState.isValid}
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 md:size-5 animate-spin" />
                      ) : (
                        "Send code"
                      )}
                    </Button>
                  </div>
                  <div className="text-center text-sm">
                    Already have an account?{" "}
                    <Link href="/login" className="underline underline-offset-4">
                      Login
                    </Link>
                  </div>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...verifyForm}>
              <form
                onSubmit={verifyForm.handleSubmit(submitVerify)}
                className="space-y-8"
              >
                <div className="grid gap-6">
                  <div className="grid gap-3">
                    <FormField
                      control={verifyForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Enter code sent to {email}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123456"
                              maxLength={6}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              className="md:h-12 md:text-lg tracking-widest"
                              autoFocus
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full md:h-12 md:text-base"
                    disabled={isLoading || !verifyForm.formState.isValid}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 md:size-5 animate-spin" />
                    ) : (
                      "Verify & create account"
                    )}
                  </Button>
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("request")}
                    >
                      Use a different email
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      onClick={async () => {
                        if (cooldown > 0 || isLoading || !email) return;
                        await resendCode();
                      }}
                      disabled={cooldown > 0 || isLoading || !email}
                      className="h-auto p-0 text-sm"
                    >
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* How-to panel (keeps your wording; shows under card) */}
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs md:text-sm text-balance *:[a]:underline *:[a]:underline-offset-4">
        <div className="mx-auto inline-block max-w-[46ch] md:max-w-[60ch] text-left">
          <p className="mb-1 font-medium text-foreground/80">How sign‑up works</p>
          <ol className="list-decimal space-y-1 md:space-y-1.5 pl-5">
            <li>Enter your name and email, then select “Send code”.</li>
            <li>Check your inbox for a 6‑digit code (valid for a few minutes).</li>
            <li>Enter the code and select “Verify &amp; create account”.</li>
            <li>You’ll be asked to create your first organisation if needed.</li>
            <li>You’ll land in your organisation home after setup.</li>
          </ol>
          <p className="mt-2 text-[11px] md:text-xs">
            Tip: If you don’t see the email, check spam/junk and ensure your inbox accepts external mail.
          </p>
        </div>
      </div>

      
    </div>
  );
}
