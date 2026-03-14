"use client";

import { ChevronRightIcon, ChevronUpIcon, FilterIcon } from "lucide-react";
import Link from "next/link";
import {
	memo,
	startTransition,
	useCallback,
	useMemo,
	useOptimistic,
	useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandList,
	CommandItem as UICommandItem,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { LoginCtaBanner } from "@/components/upgrade-cta/login-cta-banner";
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import { getEnabledFeatures } from "@/lib/features-config";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { cn } from "@/lib/utils";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { ModelSelectorLogo } from "./model-selector-logo";

type FeatureFilter = Record<string, boolean>;

const enabledFeatures = getEnabledFeatures();
const initialFilters = enabledFeatures.reduce<FeatureFilter>((acc, feature) => {
	acc[feature.key] = false;
	return acc;
}, {});

function getFeatureIcons(model: AppModelDefinition) {
	const icons: React.ReactNode[] = [];
	const enabled = getEnabledFeatures();

	const featureIconMap = [
		{
			key: "functionCalling",
			condition: model.toolCall,
			config: enabled.find((f) => f.key === "functionCalling"),
		},
		{
			key: "imageInput",
			condition: model.input?.image,
			config: enabled.find((f) => f.key === "imageInput"),
		},
		{
			key: "pdfInput",
			condition: model.input?.pdf,
			config: enabled.find((f) => f.key === "pdfInput"),
		},
	];

	for (const { condition, config } of featureIconMap) {
		if (condition && config) {
			const IconComponent = config.icon;
			icons.push(
				<div
					className="flex items-center"
					key={config.key}
					title={config.description}
				>
					<IconComponent className="h-3 w-3 text-muted-foreground" />
				</div>,
			);
		}
	}

	return icons;
}

function PureCommandItem({
	model,
	disabled,
	isSelected,
	onSelect,
}: {
	model: AppModelDefinition;
	disabled?: boolean;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const featureIcons = useMemo(() => getFeatureIcons(model), [model]);
	const searchValue = useMemo(
		() =>
			`${model.name} ${model.reasoning ? "reasoning" : ""} ${model.owned_by} `.toLowerCase(),
		[model],
	);

	const reasoningConfig = useMemo(
		() => getEnabledFeatures().find((f) => f.key === "reasoning"),
		[],
	);

	return (
		<UICommandItem
			className={cn(
				"flex h-9 w-full cursor-pointer items-center justify-between px-3 py-1.5 transition-all",
				isSelected && "border-l-2 border-l-primary bg-primary/10",
				disabled && "cursor-not-allowed opacity-50",
			)}
			onSelect={() => !disabled && onSelect()}
			value={searchValue}
		>
			<div className="flex min-w-0 flex-1 items-center gap-2.5">
				<div className="shrink-0">
					<ModelSelectorLogo modelId={model.id} />
				</div>
				<span className="flex items-center gap-1.5 truncate font-medium text-sm">
					{model.name}
					{model.reasoning && reasoningConfig && (
						<span
							className="inline-flex shrink-0 items-center gap-1"
							title={reasoningConfig.description}
						>
							<reasoningConfig.icon className="h-3 w-3 text-muted-foreground" />
						</span>
					)}
				</span>
			</div>
			{featureIcons.length > 0 && (
				<div className="flex shrink-0 items-center gap-1">{featureIcons}</div>
			)}
		</UICommandItem>
	);
}

const CommandItem = memo(
	PureCommandItem,
	(prev, next) =>
		prev.model.id === next.model.id &&
		prev.disabled === next.disabled &&
		prev.isSelected === next.isSelected,
);

function PureModelSelector({
	selectedModelId,
	className,
	onModelChangeAction,
}: {
	selectedModelId: AppModelId;
	onModelChangeAction?: (modelId: AppModelId) => void;
	className?: string;
}) {
	const { data: session } = useSession();
	const isAnonymous = !session?.user;
	const { models: chatModels, allModels } = useChatModels();

	const [open, setOpen] = useState(false);
	const [filterOpen, setFilterOpen] = useState(false);
	const [optimisticModelId, setOptimisticModelId] =
		useOptimistic(selectedModelId);
	const [featureFilters, setFeatureFilters] =
		useState<FeatureFilter>(initialFilters);

	interface ModelItem {
		disabled: boolean;
		model: AppModelDefinition;
	}

	const models = useMemo<ModelItem[]>(
		() =>
			chatModels.map((m) => ({
				model: m,
				disabled:
					isAnonymous &&
					!(
						ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]
					).includes(m.id),
			})),
		[isAnonymous, chatModels],
	);

	const hasDisabledModels = useMemo(
		() => models.some((m) => m.disabled),
		[models],
	);

	const filteredModels = useMemo(() => {
		const hasActiveFilters = Object.values(featureFilters).some(Boolean);
		if (!hasActiveFilters) {
			return models;
		}

		return models.filter(({ model }) =>
			Object.entries(featureFilters).every(([key, isActive]) => {
				if (!isActive) {
					return true;
				}
				switch (key) {
					case "reasoning":
						return model.reasoning;
					case "functionCalling":
						return model.toolCall;
					case "imageInput":
						return model.input?.image;
					case "pdfInput":
						return model.input?.pdf;
					case "audioInput":
						return model.input?.audio;
					case "imageOutput":
						return model.output?.image;
					case "audioOutput":
						return model.output?.audio;
					default:
						return true;
				}
			}),
		);
	}, [models, featureFilters]);

	const selectedItem = useMemo<ModelItem | null>(() => {
		// First try to find in filtered models (user's enabled models)
		const found = models.find((m) => m.model.id === optimisticModelId);
		if (found) {
			return found;
		}

		// Fallback: look in all models to at least display the model name
		// This handles cases where preferences are loading or model was disabled
		const fallbackModel = allModels.find((m) => m.id === optimisticModelId);
		if (fallbackModel) {
			return {
				model: fallbackModel,
				disabled:
					isAnonymous &&
					!(
						ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]
					).includes(fallbackModel.id),
			} satisfies ModelItem;
		}

		return null;
	}, [models, allModels, optimisticModelId, isAnonymous]);
	const reasoningConfig = useMemo(
		() => getEnabledFeatures().find((f) => f.key === "reasoning"),
		[],
	);
	const activeFilterCount = useMemo(
		() => Object.values(featureFilters).filter(Boolean).length,
		[featureFilters],
	);

	const selectModel = useCallback(
		(id: AppModelId) => {
			startTransition(() => {
				setOptimisticModelId(id);
				onModelChangeAction?.(id);
				setOpen(false);
			});
		},
		[onModelChangeAction, setOptimisticModelId],
	);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button
					aria-expanded={open}
					className={cn("flex w-fit justify-between gap-2 md:px-2", className)}
					data-testid="model-selector"
					role="combobox"
					variant="ghost"
				>
					<div className="flex items-center gap-2">
						{selectedItem && (
							<div className="shrink-0">
								<ModelSelectorLogo modelId={selectedItem.model.id} />
							</div>
						)}
						<p className="inline-flex items-center gap-1.5 truncate">
							{selectedItem?.model.name || "Select model"}
							{selectedItem?.model.reasoning && reasoningConfig && (
								<span
									className="inline-flex shrink-0 items-center gap-1"
									title={reasoningConfig.description}
								>
									<reasoningConfig.icon className="h-3 w-3 text-muted-foreground" />
								</span>
							)}
						</p>
					</div>
					<ChevronUpIcon
						className={cn(
							"h-4 w-4 shrink-0 opacity-50 transition-transform",
							open && "rotate-180",
						)}
					/>
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[350px] p-0"
				onInteractOutside={(e) => {
					// Prevent closing when interacting with nested filter popover
					if (
						(e.target as HTMLElement).closest('[data-slot="command-input"]')
					) {
						e.preventDefault();
					}
				}}
			>
				{open && (
					<Command>
						<div className="flex items-center border-b">
							<CommandInput
								className="px-3"
								containerClassName="w-full border-0 h-11"
								onClick={(e) => {
									// Prevent closing when interacting with nested filter popover
									e.stopPropagation();
								}}
								placeholder="Search models..."
							/>
							<Popover onOpenChange={setFilterOpen} open={filterOpen}>
								<PopoverTrigger asChild>
									<Button
										className={cn(
											"relative mr-3 h-8 w-8 p-0",
											activeFilterCount > 0 && "text-primary",
										)}
										size="sm"
										variant="ghost"
									>
										<FilterIcon className="h-4 w-4" />
										{activeFilterCount > 0 && (
											<Badge
												className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center p-0 text-xs"
												variant="secondary"
											>
												{activeFilterCount}
											</Badge>
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent align="end" className="p-0">
									<div className="p-4">
										<div className="mb-3 flex h-7 items-center justify-between">
											<div className="font-medium text-sm">Filter by Tools</div>
											{activeFilterCount > 0 && (
												<Button
													className="h-6 text-xs"
													onClick={() => setFeatureFilters(initialFilters)}
													size="sm"
													variant="ghost"
												>
													Clear filters
												</Button>
											)}
										</div>
										<div className="grid grid-cols-1 gap-2">
											{enabledFeatures.map((feature) => {
												const IconComponent = feature.icon;
												return (
													<div
														className="flex items-center space-x-2"
														key={feature.key}
													>
														<Checkbox
															checked={featureFilters[feature.key]}
															id={feature.key}
															onCheckedChange={(checked) =>
																setFeatureFilters((prev) => ({
																	...prev,
																	[feature.key]: Boolean(checked),
																}))
															}
														/>
														<Label
															className="flex items-center gap-1.5 text-sm"
															htmlFor={feature.key}
														>
															<IconComponent className="h-3.5 w-3.5" />
															{feature.name}
														</Label>
													</div>
												);
											})}
										</div>
									</div>
								</PopoverContent>
							</Popover>
						</div>
						{hasDisabledModels && (
							<div className="p-3">
								<LoginCtaBanner
									compact
									message="Sign in to unlock all models."
									variant="default"
								/>
							</div>
						)}
						<CommandList
							className="max-h-[min(25dvh,400px)]"
							onMouseDown={(e) => e.stopPropagation()}
						>
							<CommandEmpty>No model found.</CommandEmpty>
							<CommandGroup>
								{filteredModels.map(({ model, disabled }) => (
									<CommandItem
										disabled={disabled}
										isSelected={model.id === optimisticModelId}
										key={model.id}
										model={model}
										onSelect={() => selectModel(model.id)}
									/>
								))}
							</CommandGroup>
						</CommandList>
						{!isAnonymous && (
							<div className="border-t p-2">
								<Button
									asChild
									className="w-full justify-between"
									size="sm"
									variant="ghost"
								>
									<Link aria-label="Add Models" href="/settings/models">
										Add Models
										<ChevronRightIcon className="h-4 w-4" />
									</Link>
								</Button>
							</div>
						)}
					</Command>
				)}
			</PopoverContent>
		</Popover>
	);
}

export const ModelSelector = memo(
	PureModelSelector,
	(prev, next) =>
		prev.selectedModelId === next.selectedModelId &&
		prev.className === next.className &&
		prev.onModelChangeAction === next.onModelChangeAction,
);
