import React, { useState, useEffect } from 'react';
import { Layout, Menu, ConfigProvider, Typography, Avatar, Dropdown, Space, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import LiveRoomManagement from './pages/LiveRoomManagement';
import LiveStreamMonitor from './pages/LiveStreamMonitor';
import QualityDashboard from './pages/QualityDashboard';
import AnchorManagement from './pages/AnchorManagement';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
import './App.css';
import { BrowserRouter, useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

// This component now reads user info from localStorage
const UserProfile: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [userName, setUserName] = useState('用户');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserName(user.username);
    }
  }, []);

  const menu = (
    <Menu>
      <Menu.Item key="username" disabled>
        你好, {userName}
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="settings" icon={<SettingOutlined />}>
        账户设置
      </Menu.Item>
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={onLogout}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottomRight">
      <Avatar style={{ cursor: 'pointer' }} src="https://i.pravatar.cc/150?u=a042581f4e29026704d" icon={<UserOutlined />} />
    </Dropdown>
  );
};

const AppLayout: React.FC<{ onLogout: () => void; children: React.ReactNode }> = ({ onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = (e: any) => {
    navigate(e.key);
  };

  const menuItems = [
    { key: '/', label: '直播间智能看板' },
    { key: '/manage', label: '直播间管理' },
    { key: '/monitor', label: '实时监控' },
    { key: '/anchors', label: '主播管理' }
  ];

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ position: 'sticky', top: 0, zIndex: 1, width: '100%', display: 'flex', alignItems: 'center' }}>
          <Title level={4} style={{ color: 'white', margin: '0 32px 0 0', whiteSpace: 'nowrap' }}>
            科图AI直播评估管理系统
          </Title>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname]}
            onClick={handleMenuClick}
            items={menuItems}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Space align="center" style={{marginLeft: '16px'}}>
             <UserProfile onLogout={onLogout} />
             <StagewiseToolbar />
          </Space>
        </Header>
        <Content style={{ padding: '0 48px' }}>
          <div style={{ background: '#fff', minHeight: 'calc(100vh - 128px)', padding: 24 }}>
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          直播间质量智能评估系统 ©{new Date().getFullYear()} Created by Stagewise AI
        </Footer>
      </Layout>
    </ConfigProvider>
  );
};

// A wrapper for <Route> that redirects to the login screen if you're not yet authenticated.
const ProtectedRoute = ({ isLoggedIn, children }: { isLoggedIn: boolean; children: JSX.Element }) => {
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App: React.FC = () => {
  // Global auth state, initialized from localStorage
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true); // Add a loading state

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // TODO: In a real app, you should also verify the token with the backend here
      setIsLoggedIn(true);
    }
    setLoading(false); // Finish loading
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
  };

  // Render a loading indicator while checking for the token
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute isLoggedIn={isLoggedIn}>
              <AppLayout onLogout={handleLogout}>
                <Routes>
                   <Route path="/" element={<QualityDashboard />} />
                   <Route path="/manage" element={<LiveRoomManagement />} />
                   <Route path="/monitor" element={<LiveStreamMonitor />} />
                   <Route path="/anchors" element={<AnchorManagement />} />
                   {/* Redirect any other nested path to the main dashboard */}
                   <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App; 