import ProcessesPage from "@/features/processes/ProcessesPage";

interface Props {
  pod: string;
}

export default function ProcessesTab({ pod }: Props) {
  return <ProcessesPage spaceId={pod} compact />;
}
