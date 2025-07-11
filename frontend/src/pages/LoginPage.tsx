import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Row, Col, Alert } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface LoginPageProps {
  onLogin: () => void; // A function to update the auth state in App.tsx
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5555/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account: values.account,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '登录失败');
      }

      // Store token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Update auth state in App.tsx and redirect
      onLogin();
      navigate('/');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row justify="center" align="middle" style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Col>
        <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
             <Title level={2}>登录</Title>
             <Text type="secondary">欢迎回到科图AI直播评估管理系统</Text>
          </div>
           {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
          <Form
            name="normal_login"
            onFinish={onFinish}
            initialValues={{ remember: true }}
            size="large"
          >
            <Form.Item
              name="account"
              rules={[{ required: true, message: '请输入您的邮箱或手机号!' }]}
            >
              <Input prefix={<MailOutlined />} placeholder="邮箱 / 手机号" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码!' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            
            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
                登录
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
                <Text>还没有账户？</Text> <Link to="/register">立即注册</Link>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default LoginPage; 