import { useState } from "react";
import "./App.css";

const ANALYZE_URL = "http://localhost:5000/analyze";
const ANALYZE_BATCH_URL = "http://localhost:5000/analyze-batch";

function parseBatchLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((message, index) => ({
      id: index + 1,
      message,
    }));
}

function computeBatchStats(batchResult) {
  const { results = [], processed = 0, total = 0 } = batchResult;
  const successful = results.filter((row) => !row.error);
  const averageConfidence =
    successful.length === 0
      ? 0
      : successful.reduce((sum, row) => sum + row.confidence, 0) / successful.length;
  const needsHumanCount = successful.filter((row) => row.needs_human).length;

  return {
    processed,
    failed: total - processed,
    averageConfidence,
    needsHumanCount,
  };
}

function App() {
  const [mode, setMode] = useState("single");
  const [message, setMessage] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [result, setResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleModeChange(nextMode) {
    setMode(nextMode);
    setError(null);
    setResult(null);
    setBatchResult(null);
  }

  async function handleAnalyze() {
    if (!message.trim()) {
      setError("Please enter a customer message.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchAnalyze() {
    const messages = parseBatchLines(batchInput);

    if (messages.length === 0) {
      setError("Please enter at least one customer message (one per line).");
      setBatchResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setBatchResult(null);

    try {
      const response = await fetch(ANALYZE_BATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      setBatchResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const batchStats = batchResult ? computeBatchStats(batchResult) : null;

  return (
    <div className={`app ${mode === "batch" ? "app-batch" : ""}`}>
      <header className="header">
        <h1>AI Customer Message Triage</h1>
      </header>

      <main className="main">
        <section className="mode-toggle" role="tablist" aria-label="Analysis mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "single"}
            className={mode === "single" ? "mode-btn active" : "mode-btn"}
            onClick={() => handleModeChange("single")}
            disabled={loading}
          >
            Single Message
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "batch"}
            className={mode === "batch" ? "mode-btn active" : "mode-btn"}
            onClick={() => handleModeChange("batch")}
            disabled={loading}
          >
            Batch Processing
          </button>
        </section>

        {mode === "single" ? (
          <section className="input-section">
            <label htmlFor="message">Customer Message</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter a customer message..."
              rows={5}
              disabled={loading}
            />
            <button type="button" onClick={handleAnalyze} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </section>
        ) : (
          <section className="input-section">
            <label htmlFor="batch-messages">Customer Messages</label>
            <p className="input-hint">Enter one message per line. Empty lines are ignored.</p>
            <textarea
              id="batch-messages"
              className="batch-textarea"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder={"Where is my order?\nmera refund kb ayega\nplz hlp"}
              rows={12}
              disabled={loading}
            />
            <button type="button" onClick={handleBatchAnalyze} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Batch"}
            </button>
          </section>
        )}

        {error && <div className="error">{error}</div>}

        {loading && (
          <div className="loading">
            {mode === "single" ? "Analyzing message..." : "Analyzing batch..."}
          </div>
        )}

        {mode === "single" && result && !loading && (
          <section className="result-card">
            <h2>Analysis Result</h2>
            <dl className="result-fields">
              <div className="result-row">
                <dt>Category</dt>
                <dd>{result.category}</dd>
              </div>
              <div className="result-row">
                <dt>Priority</dt>
                <dd className={`priority priority-${result.priority}`}>
                  {result.priority}
                </dd>
              </div>
              <div className="result-row">
                <dt>Sentiment</dt>
                <dd>{result.sentiment}</dd>
              </div>
              <div className="result-row">
                <dt>Summary</dt>
                <dd>{result.summary}</dd>
              </div>
              <div className="result-row">
                <dt>Suggested Action</dt>
                <dd>{result.suggested_action}</dd>
              </div>
              <div className="result-row">
                <dt>Needs Human</dt>
                <dd>{result.needs_human ? "Yes" : "No"}</dd>
              </div>
              <div className="result-row">
                <dt>Confidence</dt>
                <dd>{(result.confidence * 100).toFixed(0)}%</dd>
              </div>
            </dl>
          </section>
        )}

        {mode === "batch" && batchResult && !loading && batchStats && (
          <section className="batch-results">
            <div className="batch-stats">
              <div className="stat-item">
                <span className="stat-label">Processed</span>
                <span className="stat-value">{batchStats.processed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Failed</span>
                <span className="stat-value">{batchStats.failed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Confidence</span>
                <span className="stat-value">
                  {(batchStats.averageConfidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Needs Human Count</span>
                <span className="stat-value">{batchStats.needsHumanCount}</span>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="batch-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Confidence</th>
                    <th>Needs Human</th>
                    <th>Summary</th>
                    <th>Processing Time</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResult.results.map((row) => {
                    const isError = Boolean(row.error);
                    const needsHuman = !isError && row.needs_human;

                    return (
                      <tr
                        key={row.id}
                        className={[
                          needsHuman ? "needs-human-row" : "",
                          isError ? "error-row" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <td>{row.id}</td>
                        <td>{isError ? "—" : row.category}</td>
                        <td>
                          {!isError ? (
                            <span className={`priority priority-${row.priority}`}>
                              {row.priority}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {isError ? "—" : `${(row.confidence * 100).toFixed(0)}%`}
                        </td>
                        <td>{isError ? "—" : row.needs_human ? "Yes" : "No"}</td>
                        <td className="summary-cell">
                          {isError ? row.error : row.summary}
                        </td>
                        <td>{row.processingTimeMs} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
