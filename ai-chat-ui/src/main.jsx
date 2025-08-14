import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { Auth0Provider } from '@auth0/auth0-react'
import "./index.css";

const domain = "dev-lgjtqkcbt2po3fk1.us.auth0.com"           // e.g. dev-abc123.us.auth0.com
const clientId = "dgjCJhcrXkWQThKfA2jYIiLKbe4aAvJd"      // From Auth0 dashboard

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: `https://${domain}/api/v2/`  // Needed if you want user info via API
      }}
    >
      <App />
    </Auth0Provider>l̥
  </StrictMode>,
)