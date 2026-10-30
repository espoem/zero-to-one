// Type-checks: tsc maps @lib/* through "paths". Node never reads tsconfig.json, so running this fails.
import { answer } from "@lib/answer.ts";
console.log(answer);
