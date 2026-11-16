function summarize(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  try { return JSON.stringify(x); } catch { return String(x); }
}

function observeExecution(latestExecution) {
  if (!latestExecution) {
    return {
      hasExecution: false,
      executionId: null,
      errorText: "",
      lastNode: null
    };
  }

  const resultData = latestExecution.data?.resultData || {};
  return {
    hasExecution: true,
    executionId: latestExecution.id || null,
    errorText: summarize(resultData.error || latestExecution.error || ""),
    lastNode: resultData.lastNodeExecuted || latestExecution.lastNodeExecuted || null
  };
}

module.exports = {
  observeExecution,
};
