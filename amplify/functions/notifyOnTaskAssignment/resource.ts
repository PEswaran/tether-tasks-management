import { defineFunction } from "@aws-amplify/backend";

export const notifyTaskAssignment = defineFunction({
    name: "notifyOnTaskAssignment",
    entry: "./handler.ts",
    timeoutSeconds: 10,
});
