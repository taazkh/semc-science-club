import { TestAccessForm } from "@/components/test-access-form";
import { safeReturnPath } from "@/lib/access-token";
export const metadata = { title: "Private access" };
export const dynamic = "force-dynamic";
export default async function Access({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <TestAccessForm next={safeReturnPath((await searchParams).next || null)} />
  );
}
