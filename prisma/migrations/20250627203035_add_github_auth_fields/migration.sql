-- AlterTable
ALTER TABLE "GitHubTemplate" ADD COLUMN     "githubOrganization" TEXT,
ADD COLUMN     "githubToken" TEXT,
ADD COLUMN     "owner" TEXT,
ADD COLUMN     "repoName" TEXT;
