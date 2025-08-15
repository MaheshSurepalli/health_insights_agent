import * as React from "react";
import { AppBar, Toolbar, Typography, IconButton } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth0 } from "@auth0/auth0-react";

export default function Header() {
  const { user, logout } = useAuth0();
  return (
    <AppBar position="static" color="primary" sx={{ borderRadius: 2 }}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Hi{user?.name ? `, ${user.name}` : ""} — Health Insights
        </Typography>
        <IconButton color="inherit" onClick={() => logout({ returnTo: window.location.origin })}>
          <LogoutIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
