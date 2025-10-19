'use client';
import type { ModelDefinition } from '@ai-registry/vercel-gateway';
import { allModels, getModelDefinition } from '@ai-registry/vercel-gateway';
import { ModelDetailsCard } from '@/app/(models)/compare/model-details-card';
import { ChatModelButton } from '@/components/model-action-buttons';
import { ModelSelectorBase } from '@/components/model-selector-base';
import { cn } from '@/lib/utils';

export function ModelDetails({
  className,
  modelDefinition,
  onModelChangeAction,
  enabledActions,
}: {
  className?: string;
  modelDefinition: ModelDefinition | null;
  onModelChangeAction: (nextId: string) => void;
  enabledActions?: {
    goToModel?: boolean;
    chat?: boolean;
    compare?: boolean;
  };
}) {
  return (
    <div
      className={cn('mb-6 flex w-full max-w-[450px] flex-col gap-4', className)}
    >
      <div className="flex items-center gap-2">
        <ModelSelectorBase
          className="h-9 w-fit shrink grow truncate border bg-card text-base"
          enableFilters
          initialChevronDirection="down"
          models={allModels.map((m) => ({
            id: m.id,
            definition: getModelDefinition(m.id),
          }))}
          onModelChange={onModelChangeAction}
          selectedModelId={modelDefinition?.id}
        />
        {enabledActions?.chat ? (
          <ChatModelButton
            className="h-9 whitespace-nowrap px-3"
            modelId={modelDefinition?.id}
            size="sm"
            variant="default"
          >
            Chat
          </ChatModelButton>
        ) : null}
      </div>
      <ModelDetailsCard
        enabledActions={enabledActions}
        model={modelDefinition}
      />
    </div>
  );
}
