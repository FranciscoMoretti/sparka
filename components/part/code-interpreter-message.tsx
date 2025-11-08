import { CollapsibleSection } from "../collapsible-section";
import InteractiveChart, { type BaseChart } from "../interactive-charts";

export function CodeInterpreterMessage({
  result,
  args,
}: {
  result: {
    chart: BaseChart;
    message: string;
  } | null;
  args: {
    code: string;
    title: string;
    icon: string;
  };
}) {
  return (
    <div className="space-y-6">
      <CollapsibleSection
        code={args.code}
        icon={args.icon || "default"}
        language="python"
        output={result?.message}
        status={result ? "completed" : "running"}
        title={args.title}
      />

      {result?.chart && (
        <div className="pt-1">
          <InteractiveChart chart={result.chart} />
        </div>
      )}
    </div>
  );
}
