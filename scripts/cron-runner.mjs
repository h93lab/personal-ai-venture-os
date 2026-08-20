import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.SCHEDULER_BASE_URL || "http://app:3000";
const token = process.env.SCHEDULER_TOKEN || process.env.JWT_SECRET;
if (!databaseUrl || !token) throw new Error("DATABASE_URL and SCHEDULER_TOKEN are required");

const connection = await mysql.createConnection(databaseUrl);
const jobs = [
  ["github_connections", "schedule_cron_task_uid", "/api/scheduled/github-refresh"],
  ["ai_tasks", "schedule_cron_task_uid", "/api/scheduled/ai-task"],
  ["discovery_settings", "schedule_cron_task_uid", "/api/scheduled/discovery-refresh"],
  ["competitor_settings", "schedule_cron_task_uid", "/api/scheduled/competitors-refresh"],
];

async function runOnce() {
  for (const [table, column, path] of jobs) {
    const [rows] = await connection.query(`SELECT ${column} AS taskUid FROM ${table} WHERE ${column} IS NOT NULL`);
    for (const row of rows) {
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-scheduler-token": token },
          body: JSON.stringify({ taskUid: row.taskUid }),
        });
        if (!response.ok) console.error(`[scheduler] ${path} ${row.taskUid}: ${response.status} ${await response.text()}`);
      } catch (error) {
        console.error(`[scheduler] failed ${path} ${row.taskUid}`, error);
      }
    }
  }
}

await runOnce();
await connection.end();
