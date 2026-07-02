-- CreateTable
CREATE TABLE "ai_knowledge_chunks" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source_file" TEXT,
    "source_type" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "searchable_text" TEXT,
    "lastVerified" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_chunks_source_id" ON "ai_knowledge_chunks"("sourceId");

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_chunks_category" ON "ai_knowledge_chunks"("category");

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_chunks_source_type" ON "ai_knowledge_chunks"("source_type");

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_chunks_last_verified" ON "ai_knowledge_chunks"("lastVerified");
