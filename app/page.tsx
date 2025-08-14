import { ModeSwitcher } from "@/components/mode-switcher";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Ship } from "lucide-react";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/landing");
  }

  return (
    <>
      <header className="absolute top-0 right-0 flex justify-end items-center p-4">
        <ModeSwitcher />
      </header>
      <div className="flex flex-col gap-5 items-center justify-center h-screen px-5 text-center">
        <Ship className="w-24 h-24" />

        <h1 className="text-4xl font-bold">Developed by 6005</h1>  

        <div className="flex gap-6">
          <Link href="/login">
            <Button>Login</Button>
          </Link>
          <Link href="/signup">
            <Button>Signup</Button>
          </Link>
        </div>
      </div>
    </>
  );
}
