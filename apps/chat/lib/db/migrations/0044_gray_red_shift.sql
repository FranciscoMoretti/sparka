ALTER TABLE "Message" ALTER COLUMN "selectedModel" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Message" ALTER COLUMN "selectedModel" SET DATA TYPE json USING to_json("selectedModel");--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "parallelGroupId" uuid;--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "parallelIndex" integer;--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "isPrimaryParallel" boolean;--> statement-breakpoint