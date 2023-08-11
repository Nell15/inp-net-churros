-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "id" SET DEFAULT nanoid('a:');

-- AlterTable
ALTER TABLE "BarWeek" ALTER COLUMN "id" SET DEFAULT nanoid('barweek:');

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
CREATE TABLE "UserLdap" (
    "uid" VARCHAR(255) NOT NULL,
    "gidNumber" INTEGER NOT NULL DEFAULT 1000,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "homeDirectory" TEXT NOT NULL,
    "loginShell" TEXT NOT NULL DEFAULT '/bin/bash',
    "loginTP" TEXT NOT NULL,
    "sshKey" TEXT,
    "uidNumber" INTEGER NOT NULL,

    CONSTRAINT "UserLdap_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "ObjectClass" (
    "attribute" TEXT NOT NULL,

    CONSTRAINT "ObjectClass_pkey" PRIMARY KEY ("attribute")
);

-- CreateTable
CREATE TABLE "SchoolLdap" (
    "uid" TEXT NOT NULL,
    "o" TEXT NOT NULL,

    CONSTRAINT "SchoolLdap_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "GroupLdap" (
    "uid" TEXT NOT NULL,
    "cn" TEXT NOT NULL,
    "gidNumber" INTEGER NOT NULL,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GroupLdap_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "_ObjectClassToSchoolLdap" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ObjectClassToUserLdap" (
    "A" TEXT NOT NULL,
    "B" VARCHAR(255) NOT NULL
);

-- CreateTable
CREATE TABLE "_GroupLdapToObjectClass" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLdap_uid_key" ON "UserLdap"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "UserLdap_uidNumber_key" ON "UserLdap"("uidNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectClass_attribute_key" ON "ObjectClass"("attribute");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolLdap_uid_key" ON "SchoolLdap"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolLdap_o_key" ON "SchoolLdap"("o");

-- CreateIndex
CREATE UNIQUE INDEX "GroupLdap_uid_key" ON "GroupLdap"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "GroupLdap_gidNumber_key" ON "GroupLdap"("gidNumber");

-- CreateIndex
CREATE UNIQUE INDEX "_ObjectClassToSchoolLdap_AB_unique" ON "_ObjectClassToSchoolLdap"("A", "B");

-- CreateIndex
CREATE INDEX "_ObjectClassToSchoolLdap_B_index" ON "_ObjectClassToSchoolLdap"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ObjectClassToUserLdap_AB_unique" ON "_ObjectClassToUserLdap"("A", "B");

-- CreateIndex
CREATE INDEX "_ObjectClassToUserLdap_B_index" ON "_ObjectClassToUserLdap"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GroupLdapToObjectClass_AB_unique" ON "_GroupLdapToObjectClass"("A", "B");

-- CreateIndex
CREATE INDEX "_GroupLdapToObjectClass_B_index" ON "_GroupLdapToObjectClass"("B");

-- AddForeignKey
ALTER TABLE "UserLdap" ADD CONSTRAINT "UserLdap_uid_fkey" FOREIGN KEY ("uid") REFERENCES "User"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolLdap" ADD CONSTRAINT "SchoolLdap_uid_fkey" FOREIGN KEY ("uid") REFERENCES "School"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupLdap" ADD CONSTRAINT "GroupLdap_uid_fkey" FOREIGN KEY ("uid") REFERENCES "Group"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObjectClassToSchoolLdap" ADD CONSTRAINT "_ObjectClassToSchoolLdap_A_fkey" FOREIGN KEY ("A") REFERENCES "ObjectClass"("attribute") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObjectClassToSchoolLdap" ADD CONSTRAINT "_ObjectClassToSchoolLdap_B_fkey" FOREIGN KEY ("B") REFERENCES "SchoolLdap"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObjectClassToUserLdap" ADD CONSTRAINT "_ObjectClassToUserLdap_A_fkey" FOREIGN KEY ("A") REFERENCES "ObjectClass"("attribute") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObjectClassToUserLdap" ADD CONSTRAINT "_ObjectClassToUserLdap_B_fkey" FOREIGN KEY ("B") REFERENCES "UserLdap"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupLdapToObjectClass" ADD CONSTRAINT "_GroupLdapToObjectClass_A_fkey" FOREIGN KEY ("A") REFERENCES "GroupLdap"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupLdapToObjectClass" ADD CONSTRAINT "_GroupLdapToObjectClass_B_fkey" FOREIGN KEY ("B") REFERENCES "ObjectClass"("attribute") ON DELETE CASCADE ON UPDATE CASCADE;
