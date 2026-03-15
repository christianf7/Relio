-- CreateTable
CREATE TABLE "event_check_in" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_check_in_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_check_in_event_id_idx" ON "event_check_in"("event_id");

-- CreateIndex
CREATE INDEX "event_check_in_user_id_idx" ON "event_check_in"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_check_in_event_id_user_id_key" ON "event_check_in"("event_id", "user_id");

-- AddForeignKey
ALTER TABLE "event_check_in" ADD CONSTRAINT "event_check_in_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_check_in" ADD CONSTRAINT "event_check_in_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
