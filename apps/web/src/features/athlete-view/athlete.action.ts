"use server";

import { revalidatePath } from "next/cache";
import { attendanceInput, uuid } from "@tartan/contracts";
import { spaceAction } from "@/features/shell/space-action";
import { setMyAttendance } from "@/server/athlete-view.service";

export const attendanceAction = spaceAction
  .inputSchema(attendanceInput.extend({ sessionId: uuid }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await setMyAttendance(
      ctx.userId,
      ctx.organizationId,
      parsedInput.sessionId,
      parsedInput.status,
      parsedInput.reason,
    );
    revalidatePath("/aujourdhui");
    revalidatePath(`/seance/${parsedInput.sessionId}`);
    return res;
  });
