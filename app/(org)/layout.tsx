import { Header } from "@/components/header";
import { NavigationAuthSync } from "@/components/navigation-auth-sync";

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <NavigationAuthSync />
      <div className="pt-16 min-h-[calc(100vh-4rem)] w-full">
        {children}
      </div>
    </>
  );
}
