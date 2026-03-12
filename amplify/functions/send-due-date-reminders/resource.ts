import { defineFunction } from "@aws-amplify/backend";

export const sendDueDateRemindersFn = defineFunction({
    name: "sendDueDateReminders",
    entry: "./handler.ts",
    timeoutSeconds: 120,
});
