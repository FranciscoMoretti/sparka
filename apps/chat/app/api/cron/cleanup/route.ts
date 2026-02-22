import { type NextRequest, NextResponse } from "next/server";
import { deleteFilesByUrls, listFiles } from "@/lib/blob";
import { config } from "@/lib/config";
import { getAllAttachmentUrls } from "@/lib/db/queries";
import { env } from "@/lib/env";

const ORPHANED_ATTACHMENTS_RETENTION_TIME = 4 * 60 * 60 * 1000; // 4 hours

export async function GET(request: NextRequest) {
  try {
    // Verify this is being called by Vercel cron
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = {
      orphanedAttachments: await cleanupOrphanedAttachments(),
      // Add other cleanup tasks here in the future
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("Cleanup cron job failed:", error);
    return NextResponse.json(
      {
        error: "Cleanup failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function cleanupOrphanedAttachments() {
  // Skip cleanup if neither image tool nor attachments is enabled
  const imageGenerationEnabled = config.ai.tools.image.enabled;
  const attachmentsEnabled = config.features.attachments;
  if (!(imageGenerationEnabled || attachmentsEnabled)) {
    return { deletedCount: 0, deletedUrls: [], skipped: true };
  }

  try {
    // Get all attachment URLs from all messages
    const usedAttachmentUrls = new Set(await getAllAttachmentUrls());

    // Get all blobs from Vercel Blob storage
    const { blobs } = await listFiles();

    // Find orphaned blobs (older than 1 hour and not referenced in any message)
    const oneHourAgo = new Date(
      Date.now() - ORPHANED_ATTACHMENTS_RETENTION_TIME
    );
    const orphanedUrls: string[] = [];

    for (const blob of blobs) {
      const blobDate = new Date(blob.uploadedAt);
      const isOld = blobDate < oneHourAgo;
      const isUnused = !usedAttachmentUrls.has(blob.url);

      if (isOld && isUnused) {
        orphanedUrls.push(blob.url);
      }
    }

    // Delete orphaned attachments
    if (orphanedUrls.length > 0) {
      await deleteFilesByUrls(orphanedUrls);
      console.log(`Deleted ${orphanedUrls.length} orphaned attachments`);
    }

    return {
      deletedCount: orphanedUrls.length,
      deletedUrls: orphanedUrls,
    };
  } catch (error) {
    console.error("Failed to cleanup orphaned attachments:", error);
    throw error;
  }
}
