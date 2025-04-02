// cli.ts
import { parseArgs } from "jsr:@std/cli/parse-args";

const args = parseArgs(process.argv);
console.log(args)
const command = args._[0];

switch (command) {
    case "greet":
        console.log(`Hello, ${args.name ?? "world"}!`);
        break;
    case "sum":
        const numbers = args._.slice(1).map(Number);
        console.log(`Sum: ${numbers.reduce((a, b) => a + b, 0)}`);
        break;
    default:
        console.log("Usage: cli.ts [command] [options]");
        console.log("Commands:");
        console.log("  greet --name=NAME");
        console.log("  sum NUM1 NUM2 ...");
}
