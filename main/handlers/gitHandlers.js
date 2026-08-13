const { ipcMain } = require("electron");
const { execFile } = require("child_process");

function runGit(directory, args) {
  return new Promise((resolve) => execFile("git", ["-C", directory, ...args], { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    resolve(error ? { success: false, error: stderr.trim() || error.message } : { success: true, output: stdout.trim() });
  }));
}

ipcMain.handle("git-status", (_, directory) => runGit(directory, ["status", "--short", "--branch"]));
ipcMain.handle("git-init", (_, directory) => runGit(directory, ["init"]));
ipcMain.handle("git-commit", async (_, { directory, message }) => {
  const staged = await runGit(directory, ["add", "-A"]);
  return staged.success ? runGit(directory, ["commit", "-m", message]) : staged;
});
ipcMain.handle("git-branch", (_, directory) => runGit(directory, ["branch", "--show-current"]));
ipcMain.handle("git-history", (_, directory) => runGit(directory, ["log", "--oneline", "-10"]));
ipcMain.handle("git-fetch", (_, directory) => runGit(directory, ["fetch", "--all", "--prune"]));
ipcMain.handle("git-pull", (_, directory) => runGit(directory, ["pull", "--ff-only"]));
ipcMain.handle("git-push", (_, directory) => runGit(directory, ["push"]));

module.exports = {};
