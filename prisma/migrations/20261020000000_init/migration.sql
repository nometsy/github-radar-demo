-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "tracked_repositories" (
    "full_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "topics" TEXT[],
    "html_url" TEXT NOT NULL,
    "avatar_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_repositories_pkey" PRIMARY KEY ("full_name")
);

-- CreateTable
CREATE TABLE "repository_snapshots" (
    "id" SERIAL NOT NULL,
    "repo_full_name" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "forks" INTEGER NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repository_snapshots_repo_full_name_captured_at_idx" ON "repository_snapshots"("repo_full_name", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "repository_snapshots_repo_full_name_captured_at_key" ON "repository_snapshots"("repo_full_name", "captured_at");

-- AddForeignKey
ALTER TABLE "repository_snapshots" ADD CONSTRAINT "repository_snapshots_repo_full_name_fkey" FOREIGN KEY ("repo_full_name") REFERENCES "tracked_repositories"("full_name") ON DELETE CASCADE ON UPDATE CASCADE;
