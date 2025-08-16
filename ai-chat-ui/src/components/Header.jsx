// src/components/Header.jsx
import React from "react";
import { Layout, Button, Flex } from "antd";
import { useAuth0 } from "@auth0/auth0-react";

const { Header } = Layout;

export default function HeaderBar() {
  const { user, logout } = useAuth0();
  return (
    <Header style={{ background: "#1677ff", color: "#fff" }}>
      <Flex align="center" justify="space-between">
        <div style={{ fontWeight: 600 }}>Health Insights</div>
        <Flex align="center" gap={12}>
          <div>{user?.name || "User"}</div>
          <Button
            ghost
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Log Out
          </Button>
        </Flex>
      </Flex>
    </Header>
  );
}
