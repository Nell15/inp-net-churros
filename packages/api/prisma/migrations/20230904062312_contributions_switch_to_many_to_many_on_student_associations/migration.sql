/*
  Warnings:

  - You are about to drop the column `studentAssociationId` on the `Contribution` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Contribution" DROP CONSTRAINT "Contribution_studentAssociationId_fkey";

-- DropIndex

-- AlterTable
ALTER TABLE "Announcement" ALTER COLUMN "id" SET DEFAULT nanoid('ann:');

-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "id" SET DEFAULT nanoid('a:');

-- AlterTable
ALTER TABLE "BarWeek" ALTER COLUMN "id" SET DEFAULT nanoid('barweek:');

-- AlterTable
ALTER TABLE "Contribution"
ALTER COLUMN "id" SET DEFAULT nanoid('contribution:');

-- AlterTable
ALTER TABLE "Credential" ALTER COLUMN "id" SET DEFAULT nanoid('credential:');

-- AlterTable
ALTER TABLE "EmailChange" ALTER COLUMN "id" SET DEFAULT nanoid('emailchange:');

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "id" SET DEFAULT nanoid('e:');

-- AlterTable
ALTER TABLE "GodparentRequest" ALTER COLUMN "id" SET DEFAULT nanoid('godparentreq:');

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "id" SET DEFAULT nanoid('g:');

-- AlterTable
ALTER TABLE "Link" ALTER COLUMN "id" SET DEFAULT nanoid('link:');

-- AlterTable
ALTER TABLE "LogEntry" ALTER COLUMN "id" SET DEFAULT nanoid('log:');

-- AlterTable
ALTER TABLE "LydiaAccount" ALTER COLUMN "id" SET DEFAULT nanoid('lydia:');

-- AlterTable
ALTER TABLE "LydiaTransaction" ALTER COLUMN "id" SET DEFAULT nanoid('lydiapayment:');

-- AlterTable
ALTER TABLE "Major" ALTER COLUMN "id" SET DEFAULT nanoid('major:');

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" SET DEFAULT nanoid('notif:');

-- AlterTable
ALTER TABLE "NotificationSetting" ALTER COLUMN "id" SET DEFAULT nanoid('notifsetting:');

-- AlterTable
ALTER TABLE "NotificationSubscription" ALTER COLUMN "id" SET DEFAULT nanoid('notifsub:');

-- AlterTable
ALTER TABLE "PasswordReset" ALTER COLUMN "id" SET DEFAULT nanoid('passreset:');

-- AlterTable
ALTER TABLE "Registration" ALTER COLUMN "id" SET DEFAULT nanoid('r:');

-- AlterTable
ALTER TABLE "School" ALTER COLUMN "id" SET DEFAULT nanoid('school:');

-- AlterTable
ALTER TABLE "StudentAssociation" ALTER COLUMN "id" SET DEFAULT nanoid('ae:');

-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "id" SET DEFAULT nanoid('t:');

-- AlterTable
ALTER TABLE "TicketGroup" ALTER COLUMN "id" SET DEFAULT nanoid('tg:');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT nanoid('u:');

-- AlterTable
ALTER TABLE "UserCandidate" ALTER COLUMN "id" SET DEFAULT nanoid('candidate:');

-- CreateTable
CREATE TABLE "_ContributionToStudentAssociation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ContributionToStudentAssociation_AB_unique" ON "_ContributionToStudentAssociation"("A", "B");

-- CreateIndex
CREATE INDEX "_ContributionToStudentAssociation_B_index" ON "_ContributionToStudentAssociation"("B");

-- AddForeignKey
ALTER TABLE "_ContributionToStudentAssociation" ADD CONSTRAINT "_ContributionToStudentAssociation_A_fkey" FOREIGN KEY ("A") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContributionToStudentAssociation" ADD CONSTRAINT "_ContributionToStudentAssociation_B_fkey" FOREIGN KEY ("B") REFERENCES "StudentAssociation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate foreign keys
--- Insert values into _ContributionToStudentAssociation, setting "A" to the contribution id and "B" to the studentAssociationId; reading from the Contributions table
INSERT INTO "_ContributionToStudentAssociation" ("A", "B")
SELECT "id", "studentAssociationId"
FROM "Contribution";

DROP INDEX "Contribution_userId_studentAssociationId_key";
ALTER TABLE "Contribution" DROP COLUMN "studentAssociationId";
