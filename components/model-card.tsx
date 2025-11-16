import type { ModelDefinition, ProviderId } from "@airegistry/vercel-gateway";
import { Building, Calendar, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getFeatureConfig, isFeatureEnabled } from "@/lib/features-config";
import { cn } from "@/lib/utils";
import { getProviderIcon } from "./get-provider-icon";

const PlaceholderIcon = () => <Building className="size-6" />;

const _getFeatureIconsForCard = (model: ModelDefinition) => {
  const icons: React.ReactNode[] = [];

  // Check for reasoning capability
  if (model.reasoning && isFeatureEnabled("reasoning")) {
    const config = getFeatureConfig("reasoning");
    if (config?.icon) {
      const IconComponent = config.icon;
      icons.push(
        <Tooltip key="reasoning">
          <TooltipTrigger asChild>
            <div className="rounded bg-muted p-1.5">
              <IconComponent className="size-3.5" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.description}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
  }

  return icons;
};

function ModelCardSpecs({
  maxTokens,
  contextLength,
}: {
  maxTokens?: number;
  contextLength?: number;
}) {
  return (
    <div className="flex flex-col text-start text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:gap-3 sm:text-xs">
      {maxTokens && (
        <div className="flex items-center gap-1">
          <span className="font-medium">{maxTokens.toLocaleString()}</span>
          <span className="hidden sm:inline">Max out</span>
          <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wide sm:hidden">
            out
          </span>
        </div>
      )}
      {maxTokens && contextLength && (
        <div className="hidden h-3 w-px bg-border/60 sm:block" />
      )}
      {contextLength && (
        <div className="flex items-center gap-1">
          <span className="font-medium">{contextLength.toLocaleString()}</span>
          <span className="hidden sm:inline">Max in</span>
          <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wide sm:hidden">
            in
          </span>
        </div>
      )}
    </div>
  );
}

function ModelCardBadges({ model }: { model: ModelDefinition }) {
  return (
    <div className="mt-3 flex w-full flex-wrap gap-1">
      {model.reasoning && (
        <Badge className="text-xs" variant="outline">
          Reasoning
        </Badge>
      )}
      {model.toolCall && (
        <Badge className="text-xs" variant="outline">
          Function Calling
        </Badge>
      )}
      {model.input?.image && (
        <Badge className="text-xs" variant="outline">
          Vision
        </Badge>
      )}
      {model.input?.pdf && (
        <Badge className="text-xs" variant="outline">
          PDF
        </Badge>
      )}
    </div>
  );
}

function ModelCardPricing({ model }: { model: ModelDefinition }) {
  if (!model.pricing) {
    return null;
  }

  return (
    <CardFooter>
      <div className="flex w-full items-center gap-4 text-muted-foreground text-xs">
        {model.pricing.input && (
          <div className="flex items-center gap-1">
            <Calendar className="size-3" />
            <span>
              ${(Number(model.pricing.input) * 1_000_000).toFixed(2)}/1M in
            </span>
          </div>
        )}
        {model.pricing.output && (
          <div className="flex items-center gap-1">
            <Calendar className="size-3" />
            <span>
              ${(Number(model.pricing.output) * 1_000_000).toFixed(2)}/1M out
            </span>
          </div>
        )}
      </div>
    </CardFooter>
  );
}

export function ModelCard({
  model,
  isSelected,
  isDisabled,
  disabledReason,
  className,
}: {
  model: ModelDefinition;
  isSelected?: boolean;
  isDisabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const provider = model.owned_by as ProviderId;
  const description = model.description;
  const maxTokens = model.max_tokens;
  const contextLength = model.context_window;

  // Show placeholder if disabled with reason
  if (isDisabled && disabledReason) {
    return (
      <Card
        className={cn(
          "cursor-not-allowed opacity-50",
          "bg-muted/50",
          className
        )}
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-muted p-1 transition-transform">
              <PlaceholderIcon />
            </div>
            <div className="text-left">
              <CardTitle className="font-semibold text-sm">
                {model.name}
              </CardTitle>
              <CardDescription className="capitalize">
                {provider}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full text-center text-muted-foreground text-xs">
            {disabledReason}
          </div>
        </CardContent>
      </Card>
    );
  }

  const cardContent = (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md",
        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50",
        isDisabled && "cursor-not-allowed opacity-50 hover:shadow-none",
        className
      )}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-muted p-1 transition-transform group-hover:rotate-12">
            {getProviderIcon(provider, 24)}
          </div>
          <div className="text-left">
            <CardTitle className="font-semibold text-sm">
              {model.name}
            </CardTitle>
            <CardDescription className="capitalize">{provider}</CardDescription>
          </div>
        </div>
        {isSelected && (
          <CardAction>
            <CheckCircle className="size-4 text-primary" />
          </CardAction>
        )}
      </CardHeader>

      {description && (
        <CardContent>
          <p className="mb-3 line-clamp-2 text-left text-muted-foreground text-xs">
            {description}
          </p>
        </CardContent>
      )}

      <CardContent>
        <ModelCardSpecs contextLength={contextLength} maxTokens={maxTokens} />
        <ModelCardBadges model={model} />
      </CardContent>

      <ModelCardPricing model={model} />
    </Card>
  );

  if (isDisabled) {
    return cardContent;
  }

  return <TooltipProvider>{cardContent}</TooltipProvider>;
}
