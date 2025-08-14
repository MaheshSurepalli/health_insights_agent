export function analysisToMarkdown(analysis = {}) {
  const summary = analysis?.summary || "No summary available.";
  const disclaimer = analysis?.disclaimer ? `\n\n_${analysis.disclaimer}_` : "";
  const metrics = Array.isArray(analysis?.metrics) ? analysis.metrics : [];
  if (!metrics.length) return `### Report analysis\n\n${summary}${disclaimer}`;

  const header = `| Metric | Value | Unit | Range | Status |
|---|---:|---|---|---|
`;
  const rows = metrics.map(m => {
    const val = (m?.value ?? "").toString();
    const unit = m?.unit ?? "";
    const range = m?.reference_range ?? "";
    const status = m?.status ?? "";
    return `| ${m?.name || ""} | ${val} | ${unit} | ${range} | ${status} |`;
  }).join("\n");

  const details = `\n\n<details>\n<summary>See extracted values</summary>\n\n${header}${rows}\n\n</details>`;
  return `### Report analysis\n\n${summary}${details}${disclaimer}`;
}
