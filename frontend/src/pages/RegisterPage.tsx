import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Row, Col, Alert } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5555/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          password: values.password,
          phoneNumber: values.phoneNumber,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '注册失败，请稍后重试。');
      }
      alert('注册成功！现在您可以登录了。');
      navigate('/login');
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
            <Title level={2}>创建您的账户</Title>
            <Text type="secondary">加入科图AI直播评估管理系统</Text>
          </div>
          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
          <Form
            name="normal_register"
            onFinish={onFinish}
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入您的用户名!' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item
              name="email"
              rules={[{ required: true, type: 'email', message: '请输入有效的邮箱地址!' }]}
            >
              <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
            </Form.Item>
             <Form.Item
              name="phoneNumber"
              rules={[
                {
                  pattern: /^\d{11}$/,
                  message: "请输入有效的11位手机号码!",
                },
              ]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="手机号 (可选)" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码!' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item
              name="confirm"
              dependencies={['password']}
              hasFeedback
              rules={[
                { required: true, message: '请确认您的密码!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不匹配!'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
            </Form.Item>
            
            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
                注册
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
                <Text>已经有账户了？</Text> <Link to="/login">直接登录</Link>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default RegisterPage; 