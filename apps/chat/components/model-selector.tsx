"use client";

import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, FilterIcon } from "lucide-react";
import Link from "next/link";
import {
	memo,
	type ReactNode,
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useOptimistic,
	useRef,
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { LoginCtaBanner } from "@/components/upgrade-cta/login-cta-banner";
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import {
	getPrimarySelectedModelId,
	isSelectedModelCounts,
	type SelectedModelValue,
} from "@/lib/ai/types";
import { config } from "@/lib/config";
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

function buildMultiModelSelection(
	modelIds: AppModelId[],
): Record<AppModelId, number> {
	return modelIds.reduce<Record<AppModelId, number>>(
		(acc, modelId) => {
			acc[modelId] = 1;
			return acc;
		},
		{} as Record<AppModelId, number>,
	);
}

function getSelectionCount(selection: SelectedModelValue): number {
	if (typeof selection === "string") {
		return 1;
	}

	return Object.values(selection).reduce((count, value) => count + value, 0);
}

function PureCommandItem({
	model,
	disabled,
	isSelected,
	count,
	selectionControl,
	onSelect,
	onCountChange,
}: {
	model: AppModelDefinition;
	disabled?: boolean;
	isSelected: boolean;
	count?: number;
	selectionControl?: ReactNode;
	onSelect: () => void;
	onCountChange?: (delta: number) => void;
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
				{selectionControl}
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
			<div className="flex shrink-0 items-center gap-1">
				{featureIcons}
				{isSelected && onCountChange && count !== undefined && (
					<DropdownMenu>
						<DropdownMenuTrigger
							asChild
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => e.stopPropagation()}
						>
							<button
								className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 font-semibold text-foreground text-xs tabular-nums hover:bg-primary/25"
								type="button"
							>
								{count}×
								<ChevronDownIcon className="h-2.5 w-2.5" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							onKeyDown={(e) => e.stopPropagation()}
						>
							{[1, 2, 3, 4].map((n) => (
								<DropdownMenuItem
									key={n}
									onClick={(e) => {
										e.stopPropagation();
										onCountChange(n - count);
									}}
								>
									{n}x
									{n === count && (
										<CheckIcon className="ml-auto h-3 w-3" />
									)}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</UICommandItem>
	);
}

const CommandItem = memo(
	PureCommandItem,
	(prev, next) =>
		prev.model.id === next.model.id &&
		prev.disabled === next.disabled &&
		prev.isSelected === next.isSelected &&
		prev.count === next.count &&
		(prev.onCountChange !== undefined) === (next.onCountChange !== undefined),
);

function PureModelSelector({
	selectedModelId,
	selectedModelSelection,
	className,
	onModelSelectionChangeAction,
}: {
	selectedModelId: AppModelId;
	selectedModelSelection: SelectedModelValue;
	onModelSelectionChangeAction?: (selection: SelectedModelValue) => void;
	className?: string;
}) {
	const { data: session } = useSession();
	const isAnonymous = !session?.user;
	const { models: chatModels, allModels } = useChatModels();

	const [open, setOpen] = useState(false);
	const [filterOpen, setFilterOpen] = useState(false);
	const [optimisticSelection, setOptimisticSelection] = useOptimistic(
		selectedModelSelection,
	);
	// Ref so callbacks don't capture stale optimisticSelection in their closure
	const optimisticSelectionRef = useRef(optimisticSelection);
	optimisticSelectionRef.current = optimisticSelection;
	const [featureFilters, setFeatureFilters] =
		useState<FeatureFilter>(initialFilters);
	const [useMultipleModels, setUseMultipleModels] = useState(
		isSelectedModelCounts(selectedModelSelection),
	);

	interface ModelItem {
		disabled: boolean;
		model: AppModelDefinition;
	}

	useEffect(() => {
		setUseMultipleModels(isSelectedModelCounts(selectedModelSelection));
	}, [selectedModelSelection]);

	const optimisticModelId = useMemo(
		() => getPrimarySelectedModelId(optimisticSelection) ?? selectedModelId,
		[optimisticSelection, selectedModelId],
	);

	const selectedModelIds = useMemo(() => {
		if (typeof optimisticSelection === "string") {
			return new Set<AppModelId>([optimisticSelection]);
		}

		return new Set<AppModelId>(
			Object.entries(optimisticSelection)
				.filter(([, count]) => count > 0)
				.map(([modelId]) => modelId as AppModelId),
		);
	}, [optimisticSelection]);

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
	const selectedModelCount = useMemo(
		() => getSelectionCount(optimisticSelection),
		[optimisticSelection],
	);
	const triggerLabel = useMemo(() => {
		if (useMultipleModels && selectedModelCount > 1) {
			return `${selectedItem?.model.name || "Selected model"} +${selectedModelCount - 1}`;
		}

		return selectedItem?.model.name || "Select model";
	}, [selectedItem?.model.name, selectedModelCount, useMultipleModels]);

	const selectSingleModel = useCallback(
		(id: AppModelId) => {
			startTransition(() => {
				setOptimisticSelection(id);
				onModelSelectionChangeAction?.(id);
				setOpen(false);
			});
		},
		[onModelSelectionChangeAction, setOptimisticSelection],
	);

	const toggleMultiModel = useCallback(
		(id: AppModelId) => {
			startTransition(() => {
				const current = optimisticSelectionRef.current;
				const currentCounts: Record<AppModelId, number> =
					typeof current === "string"
						? ({ [current]: 1 } as Record<AppModelId, number>)
						: (current as Record<AppModelId, number>);

				const isAlreadySelected = (currentCounts[id] ?? 0) > 0;

				let nextSelection: Record<AppModelId, number>;
				if (isAlreadySelected) {
					const remaining = Object.entries(currentCounts).filter(
						([k, v]) => k !== id && v > 0,
					);
					if (remaining.length === 0) return;
					nextSelection = Object.fromEntries(remaining) as Record<
						AppModelId,
						number
					>;
				} else {
					nextSelection = { ...currentCounts, [id]: 1 } as Record<
						AppModelId,
						number
					>;
				}

				setOptimisticSelection(nextSelection);
				onModelSelectionChangeAction?.(nextSelection);
			});
		},
		[onModelSelectionChangeAction, setOptimisticSelection],
	);

	const handleCountChange = useCallback(
		(id: AppModelId, delta: number) => {
			startTransition(() => {
				const current = optimisticSelectionRef.current;
				const currentCounts: Record<AppModelId, number> =
					typeof current === "string"
						? ({ [current]: 1 } as Record<AppModelId, number>)
						: (current as Record<AppModelId, number>);

				const newCount = (currentCounts[id] ?? 0) + delta;
				let nextSelection: SelectedModelValue;

				if (newCount <= 0) {
					const remaining = Object.entries(currentCounts).filter(
						([k, v]) => k !== id && v > 0,
					);
					if (remaining.length === 0) return;
					nextSelection = Object.fromEntries(remaining) as Record<
						AppModelId,
						number
					>;
				} else {
					nextSelection = { ...currentCounts, [id]: newCount } as Record<
						AppModelId,
						number
					>;
				}

				setOptimisticSelection(nextSelection);
				onModelSelectionChangeAction?.(nextSelection);
			});
		},
		[onModelSelectionChangeAction, setOptimisticSelection],
	);

	const handleMultipleModelsToggle = useCallback(
		(checked: boolean) => {
			setUseMultipleModels(checked);

			if (checked) {
				const nextSelection = buildMultiModelSelection([optimisticModelId]);
				startTransition(() => {
					setOptimisticSelection(nextSelection);
					onModelSelectionChangeAction?.(nextSelection);
				});
				return;
			}

			startTransition(() => {
				setOptimisticSelection(optimisticModelId);
				onModelSelectionChangeAction?.(optimisticModelId);
			});
		},
		[onModelSelectionChangeAction, optimisticModelId, setOptimisticSelection],
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
							{triggerLabel}
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
				onFocusOutside={(e) => e.preventDefault()}
				onInteractOutside={(e) => {
					// Prevent closing when interacting with nested popovers rendered in portals
					if (
						(e.target as HTMLElement).closest(
							"[data-radix-popper-content-wrapper]",
						)
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
						{!isAnonymous && config.features.parallelResponses && (
							<div className="flex items-center justify-between border-b px-3 py-2">
								<Label
									className="cursor-pointer text-sm"
									htmlFor="use-multiple-models"
								>
									Use Multiple Models
								</Label>
								<Switch
									checked={useMultipleModels}
									id="use-multiple-models"
									onCheckedChange={handleMultipleModelsToggle}
								/>
							</div>
						)}
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
								{filteredModels.map(({ model, disabled }) => {
									const isSelected = useMultipleModels
										? selectedModelIds.has(model.id)
										: model.id === optimisticModelId;
									const count =
										useMultipleModels &&
										typeof optimisticSelection !== "string"
											? (optimisticSelection as Record<AppModelId, number>)[
													model.id
												] ?? 0
											: undefined;
									return (
										<CommandItem
											count={isSelected ? count : undefined}
											disabled={disabled}
											isSelected={isSelected}
											key={model.id}
											model={model}
											onCountChange={
												useMultipleModels
													? (delta) => handleCountChange(model.id, delta)
													: undefined
											}
											onSelect={() =>
												useMultipleModels
													? toggleMultiModel(model.id)
													: selectSingleModel(model.id)
											}
											selectionControl={
												useMultipleModels ? (
													<Checkbox
														checked={isSelected}
														className="pointer-events-none"
													/>
												) : null
											}
										/>
									);
								})}
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
		prev.selectedModelSelection === next.selectedModelSelection &&
		prev.className === next.className &&
		prev.onModelSelectionChangeAction === next.onModelSelectionChangeAction,
);
