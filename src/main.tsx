import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { PosAuthProvider } from "./contexts/AuthContext";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PosAuthProvider>
      <App />
    </PosAuthProvider>
  </React.StrictMode>
);
