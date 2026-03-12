import { defineFunction } from "@aws-amplify/backend";

export const createPilotFn = defineFunction({
    name: "createPilot",
    entry: "./handler.ts",
    timeoutSeconds: 30,
});
