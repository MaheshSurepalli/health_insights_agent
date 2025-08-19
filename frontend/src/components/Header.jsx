// src/components/Header.jsx
import React from "react";
import { Layout, Button, Flex, Grid } from "antd";
import { useAuth0 } from "@auth0/auth0-react";

const { Header } = Layout;

export default function HeaderBar() {
  const { user, logout } = useAuth0();
  const screens = Grid.useBreakpoint();
  const padX = screens.xs ? 12 : 20;

  return (
    <Header style={{ background: "#1677ff", color: "#fff", paddingInline: padX }}>
      <Flex align="center" justify="space-between" wrap>
        <div style={{ fontWeight: 600, fontSize: screens.xs ? 16 : 18 }}>Health Insights</div>
        <Flex align="center" gap={12} wrap>
          <div style={{ fontSize: screens.xs ? 12 : 14 }}>{user?.name || "User"}</div>
          <Button
            size={screens.xs ? "small" : "middle"}
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
