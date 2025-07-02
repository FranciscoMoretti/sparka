import { z } from 'zod';
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from '@/trpc/init';
import {
  getDocumentById,
  getDocumentsById,
  getPublicDocumentsById,
  saveDocument,
} from '@/lib/db/queries';
import type { ArtifactKind } from '@/components/artifact';
import { TRPCError } from '@trpc/server';

export const documentRouter = createTRPCRouter({
  getDocuments: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const documents = await getDocumentsById({
        id: input.id,
        userId: ctx.user.id,
      });

      if (documents.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      return documents;
    }),

  getPublicDocuments: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const documents = await getPublicDocumentsById({ id: input.id });

      if (documents.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Public document not found',
        });
      }

      return documents;
    }),

  saveDocument: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string(),
        title: z.string(),
        kind: z.custom<ArtifactKind>(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const lastDocument = await getDocumentById({ id: input.id });

      if (!lastDocument) {
        throw new Error('Document not found');
      }

      const document = await saveDocument({
        id: input.id,
        content: input.content,
        title: input.title,
        kind: input.kind,
        userId: ctx.user.id,
        messageId: lastDocument.messageId,
      });

      return {success: true};
    }),
});
