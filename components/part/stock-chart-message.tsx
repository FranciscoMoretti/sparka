import { Check, Loader2, TrendingUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import InteractiveStockChart, {
  type StockChartProps,
} from "../interactive-stock-chart";
import { Badge } from "../ui/badge";

export function StockChartMessage({
  result,
  args,
}: {
  result: {
    chart: StockChartProps["chart"];
  } | null;
  args: {
    title: StockChartProps["title"];
    stock_symbols: StockChartProps["stock_symbols"];
    interval: StockChartProps["interval"];
  };
}) {
  return (
    <div className="mt-4 flex w-full flex-col gap-3">
      <Badge
        className={cn(
          "flex w-fit items-center gap-3 rounded-full px-4 py-2 transition-colors duration-200",
          result
            ? "bg-green-50/50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
            : "bg-blue-50/50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
        )}
        variant="secondary"
      >
        <TrendingUpIcon className="h-4 w-4" />
        <span className="font-medium">{args.title}</span>
        {result ? (
          <Check className="h-4 w-4" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
      </Badge>

      {result?.chart && (
        <div className="w-full">
          <InteractiveStockChart
            chart={{
              ...result.chart,
              x_scale: "datetime",
            }}
            data={result.chart.elements}
            interval={args.interval}
            stock_symbols={args.stock_symbols}
            title={args.title}
          />
        </div>
      )}
    </div>
  );
}
