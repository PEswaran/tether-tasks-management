import { defineFunction } from "@aws-amplify/backend";

export const sendAssignmentEmail = defineFunction({
    name: "sendAssignmentEmail",
    entry: "./handler.ts",
    timeoutSeconds: 10,
});
