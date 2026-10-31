import { getPublicData } from "@/lib/server/repository";
import { StatusView } from "@/components/status-view";
export const metadata = { title: "Payment and screenshot" };
export const dynamic = "force-dynamic";
export default async function Payment() {
  const { festival, demo } = await getPublicData();
  return <StatusView festival={festival} demo={demo} paymentPage />;
}
