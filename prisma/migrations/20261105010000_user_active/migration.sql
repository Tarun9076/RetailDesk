-- A salesman who leaves is switched off, not deleted, so the orders they took keep their name.
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
