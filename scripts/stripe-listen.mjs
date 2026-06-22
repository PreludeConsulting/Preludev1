import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const targetByMode = {
  vite: "localhost:5173/api/billing/webhook",
  api: "localhost:3001/api/billing/webhook"
};

const mode = process.argv[2] || "vite";
const forwardTo = targetByMode[mode];

if (!forwardTo) {
  console.error(`Unknown Stripe webhook target "${mode}". Use "vite" or "api".`);
  process.exit(1);
}

function findStripeCommand() {
  if (process.platform === "win32") {
    const appDataShim = path.join(process.env.APPDATA || "", "npm", "stripe.cmd");
    if (fs.existsSync(appDataShim)) return appDataShim;
  }
  return "stripe";
}

const stripeCommand = findStripeCommand();
const stripe =
  process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/c", `${stripeCommand} listen --forward-to ${forwardTo}`], {
        stdio: "inherit"
      })
    : spawn(stripeCommand, ["listen", "--forward-to", forwardTo], {
        stdio: "inherit"
      });

stripe.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
