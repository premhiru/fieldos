const scanUrl = process.env.COORDINATOR_SCAN_URL;
const cronSecret = process.env.CRON_SECRET;

if (!scanUrl || !cronSecret) {
  throw new Error("COORDINATOR_SCAN_URL and CRON_SECRET are required.");
}

const response = await fetch(`${scanUrl.replace(/\/$/, "")}/internal/coordinator-scan`, {
  headers: {
    authorization: `Bearer ${cronSecret}`
  },
  method: "POST"
});

if (!response.ok) {
  throw new Error(`Coordinator scan request failed with status ${response.status}.`);
}

const result = (await response.json()) as { queued: number };
console.log(JSON.stringify({ queued: result.queued }));
