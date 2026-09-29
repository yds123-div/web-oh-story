import { useState } from 'react';
import { App, Button, Flex, Form, Input, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { hasSession, login } from '../lib/auth';
import { errorMessage } from '../lib/errors';
import { useAuthStore } from '../stores/authStore';

type FormValues = { username: string; password: string };

export default function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);
  const [submitting, setSubmitting] = useState(false);

  // 已登录还访问 /login 就直接回首页，避免"登录后再登录"
  if (hasSession()) return <Navigate to="/" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const onFinish = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const data = await login(values.username.trim(), values.password);
      signIn(data.name);
      message.success(`欢迎回来，${data.name}`);
      navigate(from, { replace: true });
    } catch (err) {
      // 后端对「用户不存在」和「密码错」都回 400 + 同一条文案，这里如实转达
      message.error(errorMessage(err, '登录失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ds-loginWrap">
      <div className="ds-loginCard">
        <Flex vertical align="center" gap={4} style={{ marginBottom: 22 }}>
          <div className="ds-logo" style={{ marginBottom: 12 }}>
            D
          </div>
          <h1 className="ds-loginTitle">DeepSFV</h1>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            AI 短剧工坊
          </Typography.Text>
        </Flex>

        <Form<FormValues> layout="vertical" onFinish={(v) => void onFinish(v)} requiredMark={false}>
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input
              size="large"
              autoFocus
              autoComplete="username"
              prefix={<UserOutlined />}
              placeholder="账号"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              size="large"
              autoComplete="current-password"
              prefix={<LockOutlined />}
              placeholder="密码"
              onPressEnter={() => undefined}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            className="ds-grad"
            size="large"
            block
            loading={submitting}
          >
            登录
          </Button>
        </Form>
      </div>
    </div>
  );
}