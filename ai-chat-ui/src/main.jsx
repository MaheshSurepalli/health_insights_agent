import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import 'antd/dist/reset.css';

const queryClient = new QueryClient();

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience
      }}
      cacheLocation="localstorage"
      useRefreshTokens
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Auth0Provider>
  </React.StrictMode>
);
