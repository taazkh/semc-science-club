import { getPublicData } from "@/lib/server/repository";
import { StatusView } from "@/components/status-view";
export const metadata = { title: "Registration status" };
export const dynamic = "force-dynamic";
export default async function Status() {
  const { festival, demo } = await getPublicData();
  return <StatusView festival={festival} demo={demo} />;
}
