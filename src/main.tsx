import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

function showErrorOverlay(msg: string, stack?: string) {
  const div = document.createElement("div");
  div.style.cssText =
    "position:fixed;inset:12px;z-index:999999;padding:12px;border:1px solid #ef4444;background:#fef2f2;color:#991b1b;border-radius:12px;font-family:ui-sans-serif,system-ui;box-shadow:0 4px 16px rgba(0,0,0,.1);overflow:auto;max-height:80vh";
  const html = `
    <div style="font-weight:600;margin-bottom:8px">Erro em runtime</div>
    <div style="font-size:14px;white-space:pre-wrap">${msg}</div>
    ${
      stack
        ? `<pre style="margin-top:8px;font-size:12px;white-space:pre-wrap">${stack}</pre>`
        : ""
    }
  `;
  div.innerHTML = html;
  document.body.appendChild(div);
}

window.addEventListener("error", (e: any) => {
  showErrorOverlay(String(e?.error?.message || e?.message || e));
});
window.addEventListener("unhandledrejection", (e: any) => {
  showErrorOverlay(String(e?.reason?.message || e?.reason || e));
});

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    showErrorOverlay("Elemento #root não encontrado no HTML.");
  } else {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
} catch (err: any) {
  showErrorOverlay(String(err?.message || err), err?.stack);
}
