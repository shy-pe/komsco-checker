import { HealthDashboard } from "@/components/health-dashboard";
import { getSites } from "@/lib/site-repository";

export default function Page() {
  return <HealthDashboard initialSites={getSites()} />;
}
