function summarize(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  try { return JSON.stringify(x); } catch { return String(x); }
}

function observePlatform(workflow, testResult) {
  const body = summarize(testResult?.body);

  return {
    active: !!workflow?.active,
    webhook404: testResult?.status === 404,
    webhookNotRegistered: /not registered/i.test(body),
    status: testResult?.status || null
  };
}

module.exports = {
  observePlatform,
};
