import DecisionsPage from "@/features/decisions/DecisionsPage";

interface Props {
  pod: string;
}

export default function DecisionsTab({ pod }: Props) {
  return <DecisionsPage spaceId={pod} compact />;
}
