import { Menu, Button, ConfigProvider } from "antd";
import { HomeOutlined, LogoutOutlined, DashboardOutlined, BarChartOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const menuItems = [
  {
    key: "/",
    icon: <HomeOutlined />,
    label: "Главная",
  },
  {
    key: "/reports",
    icon: <BarChartOutlined />,
    label: "Отчёты",
  },
  {
    key: "/status",
    icon: <DashboardOutlined />,
    label: "Статус платформы",
  },
];

function useSelectedKey() {
  const location = useLocation();
  const path = location.pathname;
  const match = menuItems.find((item) => path === item.key || (item.key !== '/' && path.startsWith(item.key)));
  return match ? match.key : '/';
}

export default function AppSidebar({ collapsed }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const selectedKey = useSelectedKey();

  return (
    <div
      style={{
        width: collapsed ? 80 : 220,
        flexShrink: 0,
        flex: 1,
        background: "rgba(255, 255, 255, 0.62)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "none",
        borderRadius: 16,
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.7), 0 4px 24px rgba(80, 70, 150, 0.09)",
        transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <ConfigProvider
        theme={{
          components: {
            Menu: {
              itemHeight: 48,
              itemBorderRadius: 10,
              itemSelectedBg: 'rgba(67, 97, 216, 0.12)',
              itemSelectedColor: '#4361d8',
              itemHoverBg: 'rgba(67, 97, 216, 0.07)',
            },
          },
        }}
      >
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: "transparent",
            border: 0,
            flex: 1,
          }}
        />
      </ConfigProvider>

      <div
        style={{
          borderTop: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: collapsed ? "center" : "flex-start",
          transition: "padding 0.22s",
        }}
      >
        <Button
          type="text"
          danger
          icon={<LogoutOutlined />}
          onClick={logout}
          style={{
            width: "100%",
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 8,
            borderRadius: 0,
            transition: "width 0.22s",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {!collapsed && "Выйти"}
        </Button>
      </div>
    </div>
  );
}
