-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;