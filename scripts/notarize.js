// Release hook: keep Apple credentials in CI, never in this repository.
exports.default = async function notarizeIfConfigured() {
  if (
    !process.env.APPLE_ID ||
    !process.env.APPLE_APP_SPECIFIC_PASSWORD ||
    !process.env.APPLE_TEAM_ID
  ) {
    console.log(
      "Skipping notarization: Apple signing credentials are not configured.",
    );
    return;
  }
  console.log(
    "Apple credentials detected; release pipeline can notarize this build.",
  );
};
