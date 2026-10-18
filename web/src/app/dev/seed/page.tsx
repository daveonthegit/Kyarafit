import { notFound } from "next/navigation";
import SeedClient from "./SeedClient";

export default function DevSeedPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <SeedClient />;
}
