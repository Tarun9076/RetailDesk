"use client";

// The last resort: it replaces the whole page, including the layout, so it carries its own document and
// plain inline styles (no stylesheet is guaranteed to have loaded). It shows no detail about the failure.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Devanagari', sans-serif",
          background: "#fff",
          color: "#15211b",
          textAlign: "center",
          padding: 16,
        }}
      >
        <main style={{ maxWidth: 380 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 4px", color: "#5f6d66" }}>Please try again. Your orders are safe.</p>
          <p lang="hi" style={{ margin: "16px 0 24px", color: "#5f6d66" }}>
            कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 56, width: "100%", border: 0, borderRadius: 12, background: "#1b6b47", color: "#fff", fontSize: 16, fontWeight: 600 }}
          >
            Try again · फिर कोशिश करें
          </button>
          {digest && <p style={{ marginTop: 20, fontSize: 12, color: "#5f6d66" }}>Reference: {digest}</p>}
        </main>
      </body>
    </html>
  );
}
