import { SharedView } from "@/components/SharedView";

export const metadata = {
  title: "Shared family tree",
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedView token={token} />;
}
